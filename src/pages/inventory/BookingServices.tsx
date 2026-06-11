import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { Product, Category, BusinessLine } from "../../types";
import { handleFirestoreError, OperationType } from "../../lib/firestore-errors";
import { Plus, Search, Edit2, Trash2, Calendar, X, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ConfirmModal from "../../components/ConfirmModal";
import ImageUpload from "../../components/ImageUpload";

export default function BookingServices() {
  const { profile, domainTenantId } = useAuth();
  const [services, setServices] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Product | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: "danger" | "info" | "warning";
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: 0,
    category: "",
    businessLineId: "",
    description: "",
    imageUrl: "",
    type: "booking" as const,
    bookingType: "per_jam" as any,
    customBookingType: "",
    bookingDuration: "1_jam" as any,
    customBookingDuration: "",
    minDp: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!profile || !targetTenantId) return;

    // Load Categories
    const categoriesQuery = query(
      collection(db, "categories"),
      where("tenantId", "==", targetTenantId)
    );
    const unsubCategories = onSnapshot(categoriesQuery, (snap) => {
      setCategories(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Category[]
      );
    }, (err) => handleFirestoreError(err, OperationType.GET, "categories", auth, profile));

    // Load Business Lines
    const blQuery = query(
      collection(db, "business_lines"),
      where("tenantId", "==", targetTenantId)
    );
    const unsubBL = onSnapshot(blQuery, (snap) => {
      setBusinessLines(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BusinessLine[]
      );
    }, (err) => handleFirestoreError(err, OperationType.GET, "business_lines", auth, profile));

    // Load Services
    const servicesQuery = query(
      collection(db, "products"),
      where("tenantId", "==", targetTenantId),
      where("type", "==", "booking")
    );
    const unsubServices = onSnapshot(servicesQuery, (snap) => {
      setServices(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]
      );
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, "products", auth, profile));

    return () => {
      unsubCategories();
      unsubServices();
      unsubBL();
    };
  }, [profile, domainTenantId]);

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateSKU = () => {
    return "BK-" + Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  const handleOpenModal = (service?: Product) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        sku: service.sku,
        price: service.price || 0,
        category: service.category || "",
        businessLineId: service.businessLineId || "",
        description: service.description || "",
        imageUrl: service.imageUrl || "",
        type: "booking",
        bookingType: service.bookingType || "per_jam",
        customBookingType: service.customBookingType || "",
        bookingDuration: service.bookingDuration || "1_jam",
        customBookingDuration: service.customBookingDuration || "",
        minDp: service.minDp || 0,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        sku: generateSKU(),
        price: 0,
        category: "",
        businessLineId: "",
        description: "",
        imageUrl: "",
        type: "booking",
        bookingType: "per_jam",
        customBookingType: "",
        bookingDuration: "1_jam",
        customBookingDuration: "",
        minDp: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetTenantId = domainTenantId || profile?.tenantId;
    if (!targetTenantId) return;

    const duplicateSku = services.find(
      (s) => s.sku === formData.sku && s.id !== editingService?.id
    );
    if (duplicateSku) {
      alert("SKU already exists. Please use a unique SKU.");
      return;
    }

    setConfirmConfig({
      isOpen: true,
      title: editingService ? "Simpan Perubahan" : "Tambah Layanan Booking",
      message: editingService
        ? "Apakah Anda yakin ingin menyimpan perubahan pada layanan ini?"
        : "Apakah Anda yakin ingin menambah layanan booking baru?",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          if (editingService) {
            await updateDoc(doc(db, "products", editingService.id), formData);
          } else {
            await addDoc(collection(db, "products"), {
              ...formData,
              tenantId: targetTenantId,
              createdAt: serverTimestamp(),
            });
          }
          setIsModalOpen(false);
          setEditingService(null);
        } catch (err) {
          console.error(err);
          alert("Gagal menyimpan data layanan.");
        }
      },
    });
  };

  const handleDelete = (service: Product) => {
    setConfirmConfig({
      isOpen: true,
      title: "Hapus Layanan Booking",
      message: `Apakah Anda yakin ingin menghapus layanan ${service.name}?`,
      type: "danger",
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          await deleteDoc(doc(db, "products", service.id));
        } catch (err) {
          console.error(err);
          alert("Gagal menghapus layanan.");
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Layanan Booking</h2>
          <p className="text-gray-500">
            Kelola daftar layanan booking / reservasi Anda.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Layanan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari layanan (Nama / SKU)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider text-left border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-medium">Layanan</th>
                <th className="px-6 py-4 font-medium">Kategori</th>
                <th className="px-6 py-4 font-medium">Harga</th>
                <th className="px-6 py-4 font-medium">Aturan Booking</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    Belum ada data layanan booking.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {service.imageUrl ? (
                          <img
                            src={service.imageUrl}
                            alt={service.name}
                            className="w-12 h-12 rounded-lg object-cover ring-1 ring-gray-200"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center ring-1 ring-indigo-100">
                            <ImageIcon className="w-5 h-5 text-indigo-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-gray-900">{service.name}</p>
                          <p className="text-xs font-mono text-gray-500 mt-0.5">
                            {service.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium border border-gray-200/60">
                        {categories.find((c) => c.id === service.category)?.name || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      Rp {(service.price || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <span className="text-gray-500">Durasi:</span>{" "}
                        <span className="font-medium text-gray-900 capitalize">
                          {service.bookingDuration === "custom"
                            ? service.customBookingDuration
                            : service.bookingDuration?.replace("_", " ")}
                        </span>
                        <br />
                        <span className="text-gray-500">Tarif:</span>{" "}
                        <span className="font-medium text-gray-900 capitalize">
                          {service.bookingType === "custom"
                            ? service.customBookingType
                            : service.bookingType?.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(service)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(service)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingService ? "Edit Layanan Booking" : "Tambah Layanan Booking"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 bg-white overflow-y-auto max-h-[80vh]">
                <div className="space-y-6">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block mb-1 text-xs font-semibold text-gray-600">
                        Nama Layanan
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Contoh: Sewa Studio Foto"
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-600">
                        SKU (Otomatis)
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.sku}
                        onChange={(e) =>
                          setFormData({ ...formData, sku: e.target.value })
                        }
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-600">
                        Kategori Layanan
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Pilih Kategori</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {businessLines.length > 0 && (
                      <div className="col-span-2">
                        <label className="block mb-1 text-xs font-semibold text-gray-600">
                          Market Bisnis (Opsional)
                        </label>
                        <select
                          value={formData.businessLineId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              businessLineId: e.target.value,
                            })
                          }
                          className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Tanpa Market Bisnis</option>
                          {businessLines.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-2 gap-4">
                    <h4 className="col-span-2 text-sm font-bold text-indigo-900 pb-2 border-b border-indigo-100 flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Pengaturan Booking
                    </h4>
                    
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-indigo-900">
                        Durasi Layanan
                      </label>
                      <select
                        value={formData.bookingDuration || "1_jam"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bookingDuration: e.target.value as any,
                          })
                        }
                        className="w-full p-2 border border-indigo-200/60 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="30_menit">30 Menit</option>
                        <option value="1_jam">1 Jam</option>
                        <option value="2_jam">2 Jam</option>
                        <option value="1_hari">1 Hari</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {formData.bookingDuration === "custom" && (
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-indigo-900">
                          Custom Durasi
                        </label>
                        <input
                          type="text"
                          value={formData.customBookingDuration || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customBookingDuration: e.target.value,
                            })
                          }
                          placeholder="Contoh: 3 Bulan"
                          className="w-full p-2 border border-indigo-200/60 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          required={formData.bookingDuration === "custom"}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block mb-1 text-xs font-semibold text-indigo-900">
                        Tipe Tarif Booking
                      </label>
                      <select
                        value={formData.bookingType || "per_jam"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bookingType: e.target.value as any,
                          })
                        }
                        className="w-full p-2 border border-indigo-200/60 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="per_jam">Per Jam</option>
                        <option value="per_hari">Per Hari</option>
                        <option value="per_sesi">Per Sesi</option>
                        <option value="per_event">Per Event</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {formData.bookingType === "custom" && (
                      <div>
                        <label className="block mb-1 text-xs font-semibold text-indigo-900">
                          Custom Tarif
                        </label>
                        <input
                          type="text"
                          value={formData.customBookingType || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customBookingType: e.target.value,
                            })
                          }
                          placeholder="Contoh: Per Minggu"
                          className="w-full p-2 border border-indigo-200/60 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          required={formData.bookingType === "custom"}
                        />
                      </div>
                    )}
                    
                    <div className="col-span-2 md:col-span-1">
                      <label className="block mb-1 text-xs font-semibold text-indigo-900 flex items-center gap-1">
                        Tarif / Harga Layanan
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                        <input
                          type="number"
                          required
                          min="0"
                          value={formData.price || 0}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              price: Number(e.target.value),
                            })
                          }
                          className="w-full pl-10 pr-3 py-2 border border-indigo-200/80 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-indigo-900 text-lg shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="block mb-1 text-xs font-semibold text-indigo-900">
                        Minimal Uang Muka (DP)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.minDp || 0}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              minDp: Number(e.target.value),
                            })
                          }
                          className="w-full pl-10 pr-3 py-2 border border-indigo-200/60 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <ImageUpload
                      value={formData.imageUrl}
                      onChange={(url) =>
                        setFormData({ ...formData, imageUrl: url })
                      }
                      label="Foto Layanan (Opsional)"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block mb-1 text-xs font-semibold text-gray-600">
                      Deskripsi Layanan
                    </label>
                    <textarea
                      value={formData.description || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={3}
                      className="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Tuliskan detail layanan, syarat & ketentuan singkat..."
                    />
                  </div>

                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm transition-all shadow-indigo-200"
                  >
                    {editingService ? "Simpan Perubahan" : "Simpan Layanan"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={confirmConfig?.isOpen || false}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={() => setConfirmConfig(null)}
        type={confirmConfig?.type || "info"}
      />
    </div>
  );
}
