import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, where, addDoc, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Service, Booking, UserProfile } from '../types';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Search, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  X,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export const BookingPage: React.FC = () => {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    serviceId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    status: 'Pending' as Booking['status']
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!profile?.tenantId) return;
    setLoading(true);
    try {
      const bQuery = query(
        collection(db, 'bookings'), 
        where('tenantId', '==', profile.tenantId),
        orderBy('createdAt', 'desc')
      );
      const bSnap = await getDocs(bQuery);
      setBookings(bSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking)));

      const sQuery = query(
        collection(db, 'services'),
        where('tenantId', '==', profile.tenantId)
      );
      const sSnap = await getDocs(sQuery);
      setServices(sSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));

      const cQuery = query(
        collection(db, 'users'),
        where('role', '==', 'Customer'),
        where('tenantId', '==', profile.tenantId)
      );
      const cSnap = await getDocs(cQuery);
      setCustomers(cSnap.docs.map(doc => doc.data() as UserProfile));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenantId) return;
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const selectedService = services.find(s => s.id === formData.serviceId);
      const selectedCustomer = customers.find(c => c.uid === formData.customerId);

      if (!selectedService || !selectedCustomer) {
        throw new Error('Service or Customer not found');
      }

      const bookingData = {
        tenantId: profile.tenantId,
        customerId: selectedCustomer.uid,
        customerName: selectedCustomer.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        date: formData.date,
        time: formData.time,
        status: formData.status,
        total: selectedService.price,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'bookings'), bookingData);
      
      // Also record as income transaction
      await addDoc(collection(db, 'transactions'), {
        tenantId: profile.tenantId,
        type: 'Income',
        category: 'Service Booking',
        amount: selectedService.price,
        description: `Booking for ${selectedService.name} - ${selectedCustomer.name}`,
        date: new Date().toISOString()
      });

      setSuccess('Booking berhasil dibuat.');
      setFormData({
        customerId: '',
        serviceId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        time: '09:00',
        status: 'Pending'
      });
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBookings = bookings.filter(b => 
    b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking & Janji Temu</h1>
          <p className="text-gray-500 text-sm">Kelola jadwal layanan dan reservasi pelanggan Anda.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span>Tambah Booking</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Cari pelanggan atau layanan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all">
            <Filter size={18} />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Layanan</th>
                <th className="px-6 py-4">Jadwal</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin inline-block text-indigo-600" size={32} />
                  </td>
                </tr>
              ) : filteredBookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {booking.customerName[0]}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{booking.customerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.serviceName}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{format(new Date(booking.date), 'dd MMM yyyy')}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} /> {booking.time}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">Rp {booking.total.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit",
                      booking.status === 'Completed' ? "bg-green-50 text-green-600" :
                      booking.status === 'Confirmed' ? "bg-blue-50 text-blue-600" :
                      booking.status === 'Cancelled' ? "bg-red-50 text-red-600" :
                      "bg-yellow-50 text-yellow-600"
                    )}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {booking.status === 'Pending' && (
                        <button 
                          onClick={() => updateBookingStatus(booking.id, 'Confirmed')}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Confirm"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                      {booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
                        <button 
                          onClick={() => updateBookingStatus(booking.id, 'Completed')}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Complete"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                      {booking.status !== 'Cancelled' && (
                        <button 
                          onClick={() => updateBookingStatus(booking.id, 'Cancelled')}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Cancel"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Tambah Booking Baru</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Pelanggan</label>
                <select
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map(c => (
                    <option key={c.uid} value={c.uid}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Layanan</label>
                <select
                  required
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="">-- Pilih Layanan --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - Rp {s.price.toLocaleString()}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Waktu</label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Simpan Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
