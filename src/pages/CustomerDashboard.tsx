import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  MapPin, 
  Clock, 
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  Package, 
  CheckCircle2, XCircle, Search, ArrowLeft, User, Save, LogOut, Plus, Trash2, Edit2, Star, Eye
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Order, UserAddress } from '../types';

type Tab = 'overview' | 'history' | 'status' | 'downloads' | 'address';

// Extend Order type inline for bookingInfo
type DashboardOrder = Order & { bookingInfo?: any };

export default function CustomerDashboard() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const getTabFromPath = (): Tab => {
    if (location.pathname.endsWith('/status')) return 'status';
    if (location.pathname.endsWith('/history')) return 'history';
    if (location.pathname.endsWith('/downloads')) return 'downloads';
    if (location.pathname.endsWith('/address')) return 'address';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<Tab>(getTabFromPath());

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [location.pathname]);
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [tenant, setTenant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isBookingTenant = location.pathname.startsWith('/booking/');
  const nextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const prevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);

  const confirmedBookings = orders.filter(o => 
    o.bookingInfo && (o.bookingInfo.status === 'confirmed' || o.bookingInfo.status === 'completed')
  );
  
  // Addresses State
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  
  const [addressDetails, setAddressDetails] = useState({
    receiverName: '',
    phone: '',
    province: '',
    city: '',
    district: '',
    village: '',
    postalCode: '',
    detail: '',
    isMain: false
  });
  
  const [provinces, setProvinces] = useState<{id: string, name: string}[]>([]);
  const [cities, setCities] = useState<{id: string, name: string}[]>([]);
  const [districts, setDistricts] = useState<{id: string, name: string}[]>([]);
  const [villages, setVillages] = useState<{id: string, name: string}[]>([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedVillageId, setSelectedVillageId] = useState('');

  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (activeTab === 'address' && provinces.length === 0) {
      fetch('https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json')
        .then(res => res.json())
        .then(data => setProvinces(data))
        .catch(console.error);
    }
  }, [activeTab, provinces.length]);

  useEffect(() => {
    if (selectedProvinceId) {
      fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${selectedProvinceId}.json`)
        .then(res => res.json())
        .then(data => setCities(data))
        .catch(console.error);
      setAddressDetails(prev => ({...prev, province: provinces.find(p => p.id === selectedProvinceId)?.name || '', city: '', district: '', village: ''}));
    }
  }, [selectedProvinceId, provinces]);

  useEffect(() => {
    if (selectedCityId) {
      fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/districts/${selectedCityId}.json`)
        .then(res => res.json())
        .then(data => setDistricts(data))
        .catch(console.error);
      setAddressDetails(prev => ({...prev, city: cities.find(c => c.id === selectedCityId)?.name || '', district: '', village: ''}));
    }
  }, [selectedCityId, cities]);

  useEffect(() => {
    if (selectedDistrictId) {
      fetch(`https://www.emsifa.com/api-wilayah-indonesia/api/villages/${selectedDistrictId}.json`)
        .then(res => res.json())
        .then(data => setVillages(data))
        .catch(console.error);
      setAddressDetails(prev => ({...prev, district: districts.find(d => d.id === selectedDistrictId)?.name || '', village: ''}));
    }
  }, [selectedDistrictId, districts]);

  useEffect(() => {
    if (selectedVillageId) {
      setAddressDetails(prev => ({...prev, village: villages.find(v => v.id === selectedVillageId)?.name || ''}));
    }
  }, [selectedVillageId, villages]);

  useEffect(() => {
    if (profile?.addresses && profile.addresses.length > 0) {
      setAddresses(profile.addresses);
    } else if (profile && (profile?.addressDetails || profile?.address)) {
      // Migrate old address format if no addresses exist
      setAddresses([{
        id: 'default',
        receiverName: profile.displayName || '',
        phone: '',
        province: profile.addressDetails?.province || '',
        city: profile.addressDetails?.city || '',
        district: profile.addressDetails?.district || '',
        village: profile.addressDetails?.village || '',
        postalCode: profile.addressDetails?.postalCode || '',
        detail: profile.addressDetails?.detail || profile.address || '',
        fullAddress: profile.address || '',
        isMain: true
      }]);
    }
  }, [profile]);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user || !tenantSlug) return;

      try {
        // Find tenant first to get ID
        const tenantQuery = query(collection(db, 'tenants'), where('slug', '==', tenantSlug));
        const tenantSnap = await getDocs(tenantQuery);
        
        if (tenantSnap.empty) {
          setLoading(false);
          return;
        }

        const tenantData = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() };
        setTenant(tenantData);
        const tenantId = tenantData.id;

        // Fetch orders for this tenant and user
        const q = query(
          collection(db, 'orders'),
          where('tenantId', '==', tenantId),
          where('userId', '==', user.uid)
        );
        
        const snap = await getDocs(q);
        let ordersData = snap.docs.map(d => ({ id: d.id, ...d.data() } as DashboardOrder));
        
        // Fetch booking info for booking tenant
        if (location.pathname.startsWith('/booking/')) {
          const orderNumbers = ordersData.map(o => o.orderNumber).filter(Boolean);
          const bookingsMap = new Map();
          
          for (let i = 0; i < orderNumbers.length; i += 10) {
            const chunk = orderNumbers.slice(i, i + 10);
            if (chunk.length > 0) {
              const bQuery = query(
                collection(db, 'payment_corrections'),
                where('tenantId', '==', tenantId),
                where('docType', '==', 'booking'),
                where('invoiceNumber', 'in', chunk)
              );
              try {
                const bSnap = await getDocs(bQuery);
                bSnap.forEach(doc => {
                  bookingsMap.set(doc.data().invoiceNumber, doc.data());
                });
              } catch (err) {
                console.error("Error fetching bookings:", err);
              }
            }
          }

          ordersData.forEach(o => {
            if (bookingsMap.has(o.orderNumber)) {
              o.bookingInfo = bookingsMap.get(o.orderNumber);
            }
          });
        }

        // Sort in memory because composite index might not exist yet
        ordersData.sort((a, b) => {
          const dateA = a.date?.seconds || 0;
          const dateB = b.date?.seconds || 0;
          return dateB - dateA;
        });

        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchOrders();
    }
  }, [user, authLoading, tenantSlug]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (addresses.length >= 5 && !editingAddressId) {
      alert('Maksimal 5 alamat.');
      return;
    }

    setIsSavingAddress(true);
    try {
      const combinedAddress = `${addressDetails.detail}, ${addressDetails.village}, ${addressDetails.district}, ${addressDetails.city}, ${addressDetails.province} ${addressDetails.postalCode}`;
      let updatedAddresses = [...addresses];
      
      const newAddress: UserAddress = {
        id: editingAddressId || Date.now().toString(),
        receiverName: addressDetails.receiverName,
        phone: addressDetails.phone,
        province: addressDetails.province,
        city: addressDetails.city,
        district: addressDetails.district,
        village: addressDetails.village,
        postalCode: addressDetails.postalCode,
        detail: addressDetails.detail,
        fullAddress: combinedAddress,
        isMain: addressDetails.isMain || addresses.length === 0
      };

      if (newAddress.isMain) {
        updatedAddresses = updatedAddresses.map(a => ({ ...a, isMain: false }));
      }

      if (editingAddressId) {
        updatedAddresses = updatedAddresses.map(a => a.id === editingAddressId ? newAddress : a);
      } else {
        updatedAddresses.push(newAddress);
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        addresses: updatedAddresses,
        ...(newAddress.isMain ? {
          address: newAddress.fullAddress,
          addressDetails: {
            province: newAddress.province,
            city: newAddress.city,
            district: newAddress.district,
            village: newAddress.village,
            postalCode: newAddress.postalCode,
            detail: newAddress.detail
          }
        } : {})
      });
      
      if (newAddress.isMain && tenant) {
        const cq = query(collection(db, 'customers'), where('uid', '==', user.uid), where('tenantId', '==', tenant.id));
        const csnap = await getDocs(cq);
        if (!csnap.empty) {
          const cDocRef = doc(db, 'customers', csnap.docs[0].id);
           await updateDoc(cDocRef, {
             address: newAddress.fullAddress,
             phone: newAddress.phone || '-',
             province: newAddress.province || '',
             regency: newAddress.city || '',
             district: newAddress.district || '',
             village: newAddress.village || '',
           });
        }
      }
      
      setAddresses(updatedAddresses);
      setIsAddressModalOpen(false);
      resetAddressForm();
    } catch (error) {
      console.error('Error updating address:', error);
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !window.confirm('Yakin ingin menghapus alamat ini?')) return;

    try {
      const updatedAddresses = addresses.filter(a => a.id !== id);
      // If deleted was main, make first one main
      if (addresses.find(a => a.id === id)?.isMain && updatedAddresses.length > 0) {
        updatedAddresses[0].isMain = true;
      }
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { addresses: updatedAddresses });
      setAddresses(updatedAddresses);
    } catch (error) {
      console.error('Error deleting address:', error);
    }
  };

  const handleSetMainAddress = async (id: string) => {
    if (!user) return;
    try {
      const updatedAddresses = addresses.map(a => ({ ...a, isMain: a.id === id }));
      const newMain = updatedAddresses.find(a => a.isMain);
      if(!newMain) return;

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        addresses: updatedAddresses,
        address: newMain.fullAddress,
        addressDetails: {
          province: newMain.province,
          city: newMain.city,
          district: newMain.district,
          village: newMain.village,
          postalCode: newMain.postalCode,
          detail: newMain.detail
        }
      });
      
      if (tenant) {
        const cq = query(collection(db, 'customers'), where('uid', '==', user.uid), where('tenantId', '==', tenant.id));
        const csnap = await getDocs(cq);
        if (!csnap.empty) {
          const cDocRef = doc(db, 'customers', csnap.docs[0].id);
           await updateDoc(cDocRef, {
             address: newMain.fullAddress,
             phone: newMain.phone || '-',
             province: newMain.province || '',
             regency: newMain.city || '',
             district: newMain.district || '',
             village: newMain.village || '',
           });
        }
      }
      setAddresses(updatedAddresses);
    } catch (error) {
      console.error('Error setting main address:', error);
    }
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressDetails({
      receiverName: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      village: '',
      postalCode: '',
      detail: '',
      isMain: false
    });
    setSelectedProvinceId('');
    setSelectedCityId('');
    setSelectedDistrictId('');
    setSelectedVillageId('');
  };

  const openEditAddressModal = (address: UserAddress) => {
    setEditingAddressId(address.id);
    setAddressDetails({
      receiverName: address.receiverName || '',
      phone: address.phone || '',
      province: address.province || '',
      city: address.city || '',
      district: address.district || '',
      village: address.village || '',
      postalCode: address.postalCode || '',
      detail: address.detail || '',
      isMain: address.isMain || false
    });
    // Trigger effects to load regencies/districts etc will be hard because we need the IDs.
    // For simplicity, we just set the text values and clear IDs since the dropdowns allow string values if no ID is selected.
    setSelectedProvinceId('');
    setSelectedCityId('');
    setSelectedDistrictId('');
    setSelectedVillageId('');
    setIsAddressModalOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'processing': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 text-green-700 border-green-100';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'RECEIVED';
      case 'processing': return 'Processing';
      case 'pending': return 'PENDING';
      case 'cancelled': return 'CANCELLED';
      default: return status.toUpperCase();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 pb-20 min-h-[calc(100vh-80px)]">
      <div className="w-full mx-auto px-4 py-8">
        {/* Profile Info (Inline) */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-gray-900">Halo, {profile?.displayName || 'Pelanggan'}!</h2>
          <p className="text-gray-500">Kelola pesanan dan alamat pengiriman Anda di sini.</p>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Package className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Pesanan</p>
                    <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Pesanan Selesai</p>
                    <p className="text-2xl font-bold text-gray-900">{orders.filter(o => o.status === 'completed' || (o.bookingInfo && (o.bookingInfo.status === 'completed' || o.bookingInfo.status === 'confirmed'))).length}</p>
                  </div>
                </div>
              </div>

              {isBookingTenant && (
                <div className="bg-white rounded-lg p-6 border border-gray-100 shadow-sm mt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-black text-gray-900">Jadwal Booking Terkonfirmasi</h3>
                    </div>
                    <div className="flex items-center gap-4 bg-gray-50 p-1.5 rounded-full border border-gray-100">
                      <button onClick={prevMonth} className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
                      <span className="font-bold text-gray-900 min-w-[100px] text-center text-sm">{format(currentMonth, 'MMMM yyyy', { locale: idLocale })}</span>
                      <button onClick={nextMonth} className="p-2 bg-white hover:bg-gray-100 rounded-full shadow-sm transition"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
                      <div key={day} className="bg-gray-50 p-2 sm:p-3 text-center text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: startDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="bg-white p-2 min-h-[80px] sm:min-h-[120px]" />
                    ))}
                    {monthDays.map(day => {
                      const formattedDay = format(day, 'yyyy-MM-dd');
                      const dayBookings = confirmedBookings.filter(o => {
                        const dateStr = o.bookingInfo?.bookingDate || (o.customerInfo as any)?.bookingDate;
                        return dateStr === formattedDay;
                      });
                      const isToday = isSameDay(day, new Date());

                      return (
                        <div key={day.toString()} className={`bg-white p-1.5 sm:p-2 min-h-[80px] sm:min-h-[120px] transition hover:bg-gray-50 ${isToday ? 'ring-2 ring-indigo-600 ring-inset relative z-10' : ''}`}>
                          <div className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-1 sm:mb-2 ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                            {format(day, 'd')}
                          </div>
                          <div className="space-y-1.5 max-h-[60px] sm:max-h-[80px] overflow-y-auto no-scrollbar">
                            {dayBookings.map((b, i) => {
                               const time = b.bookingInfo?.bookingTime || (b.customerInfo as any)?.bookingTime || '';
                               const serviceName = b.bookingInfo?.serviceName || (b.items && b.items.length > 0 ? b.items[0].name : 'Booking');
                               return (
                                <div key={`${b.id}-${i}`} className="text-[9px] sm:text-[10px] px-1.5 py-1 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 font-semibold truncate leading-tight" title={`${time} - ${serviceName}`}>
                                  {time} <span className="opacity-75">{serviceName}</span>
                                </div>
                               );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {Array.from({ length: (7 - ((startDay + monthDays.length) % 7)) % 7 }).map((_, i) => (
                      <div key={`empty-end-${i}`} className="bg-white p-2 min-h-[80px] sm:min-h-[120px]" />
                    ))}
                  </div>
                  
                  {confirmedBookings.length === 0 && (
                    <div className="text-center mt-8 mb-4">
                      <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm font-medium">Belum ada jadwal booking yang dikonfirmasi bulan ini.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'downloads' && (
            <motion.div
              key="downloads"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-md p-12 text-center border border-gray-100">
                <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Belum ada file yang dapat didownload.</p>
              </div>
            </motion.div>
          )}
          
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {orders.length === 0 ? (
                <div className="bg-white rounded-md p-12 text-center border border-gray-100">
                  <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Belum ada riwayat pembelian.</p>
                </div>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="bg-white rounded-md p-6 shadow-sm border border-gray-100 hover:border-indigo-100 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-bold text-indigo-600 mb-1">{order.orderNumber}</p>
                        <p className="text-sm text-gray-500">
                          {order.date || (order as any).createdAt ? new Date((order.date?.seconds || (order as any).createdAt?.seconds || 0) * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Baru saja'}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.name} <span className="text-gray-400">x{item.quantity}</span></span>
                          <span className="font-bold text-gray-900">Rp.{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Pembayaran</span>
                      <span className="text-lg font-black text-indigo-600">Rp.{(order.totalAmount || (order as any).total || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'status' && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length === 0 ? (
                <div className="bg-white rounded-md p-12 text-center border border-gray-100">
                  <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Tidak ada pesanan aktif saat ini.</p>
                </div>
              ) : (
                orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').map((order) => (
                  <div key={order.id} className="bg-white rounded-md p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 rounded-md flex items-center justify-center ${
                        order.status === 'processing' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {order.status === 'processing' ? <Package className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-black text-gray-900">Pesanan Sedang {order.status === 'processing' ? 'Diproses' : 'Menunggu'}</h3>
                        <p className="text-xs text-gray-500">ID: {order.orderNumber}</p>
                      </div>
                    </div>

                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-8">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: order.status === 'processing' ? '66%' : '33%' }}
                        className="absolute top-0 left-0 h-full bg-indigo-600"
                      />
                    </div>

                    <div className="grid grid-cols-3 text-center text-[10px] font-bold uppercase tracking-wider">
                      <div className={order.status === 'pending' || order.status === 'processing' ? 'text-indigo-600' : 'text-gray-400'}>Diterima</div>
                      <div className={order.status === 'processing' ? 'text-indigo-600' : 'text-gray-400'}>Diproses</div>
                      <div className="text-gray-400">Selesai</div>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'address' && (
            <motion.div
              key="address"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-white rounded-md p-8 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-md flex items-center justify-center text-indigo-600">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900">Alamat Pengiriman</h3>
                  </div>
                  {addresses.length < 5 && (
                    <button
                      onClick={() => { resetAddressForm(); setIsAddressModalOpen(true); }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold text-sm hover:bg-indigo-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Alamat
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold">
                        <th className="p-4 rounded-tl-md">No.</th>
                        <th className="p-4">Nama Penerima</th>
                        <th className="p-4">Alamat</th>
                        <th className="p-4">No Hp</th>
                        <th className="p-4 rounded-tr-md">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addresses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500">
                            Belum ada alamat tersimpan
                          </td>
                        </tr>
                      ) : (
                        addresses.map((address, idx) => (
                          <tr key={address.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="p-4 text-gray-500">{idx + 1}</td>
                            <td className="p-4 font-semibold text-gray-900">
                              {address.receiverName || profile?.displayName || '-'}
                              {address.isMain && (
                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] uppercase font-bold tracking-wider">
                                  <Star className="w-3 h-3" /> Utama
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-gray-600">
                              <p className="line-clamp-2 max-w-[300px]">{address.fullAddress}</p>
                            </td>
                            <td className="p-4 text-gray-600">{address.phone || '-'}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {!address.isMain && (
                                  <button
                                    onClick={() => handleSetMainAddress(address.id)}
                                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition"
                                    title="Jadikan Utama"
                                  >
                                    <Star className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditAddressModal(address)}
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteAddress(address.id, e)}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
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
            </motion.div>
          )}
        </AnimatePresence>

        {isAddressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden my-8"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-xl font-black text-gray-900">
                  {editingAddressId ? 'Edit Alamat' : 'Tambah Alamat'}
                </h3>
                <button
                  onClick={() => setIsAddressModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <form id="addressForm" onSubmit={handleSaveAddress} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Nama Penerima</label>
                      <input
                        type="text"
                        required
                        value={addressDetails.receiverName}
                        onChange={(e) => setAddressDetails(prev => ({...prev, receiverName: e.target.value}))}
                        placeholder="Contoh: Budi Susanto"
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Nomor HP</label>
                      <input
                        type="tel"
                        required
                        value={addressDetails.phone}
                        onChange={(e) => setAddressDetails(prev => ({...prev, phone: e.target.value}))}
                        placeholder="Contoh: 08123456789"
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Provinsi {addressDetails.province && !selectedProvinceId && `(${addressDetails.province})`}</label>
                      <select
                        required={!addressDetails.province}
                        value={selectedProvinceId}
                        onChange={(e) => setSelectedProvinceId(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                      >
                        <option value="">Pilih Provinsi</option>
                        {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Kota/Kabupaten {addressDetails.city && !selectedCityId && `(${addressDetails.city})`}</label>
                      <select
                        required={!addressDetails.city}
                        disabled={!selectedProvinceId}
                        value={selectedCityId}
                        onChange={(e) => setSelectedCityId(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-all text-gray-900 font-medium"
                      >
                        <option value="">Pilih Kota/Kabupaten</option>
                        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Kecamatan {addressDetails.district && !selectedDistrictId && `(${addressDetails.district})`}</label>
                      <select
                        required={!addressDetails.district}
                        disabled={!selectedCityId}
                        value={selectedDistrictId}
                        onChange={(e) => setSelectedDistrictId(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-all text-gray-900 font-medium"
                      >
                        <option value="">Pilih Kecamatan</option>
                        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Desa/Kelurahan {addressDetails.village && !selectedVillageId && `(${addressDetails.village})`}</label>
                      <select
                        required={!addressDetails.village}
                        disabled={!selectedDistrictId}
                        value={selectedVillageId}
                        onChange={(e) => setSelectedVillageId(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 transition-all text-gray-900 font-medium"
                      >
                        <option value="">Pilih Desa/Kelurahan</option>
                        {villages.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-2 text-xs font-semibold text-gray-600">Kode Pos</label>
                      <input
                        type="text"
                        required
                        value={addressDetails.postalCode}
                        onChange={(e) => setAddressDetails(prev => ({...prev, postalCode: e.target.value}))}
                        placeholder="Contoh: 40135"
                        className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2 text-xs font-semibold text-gray-600">Alamat Lengkap & Patokan</label>
                    <textarea
                      value={addressDetails.detail}
                      onChange={(e) => setAddressDetails(prev => ({...prev, detail: e.target.value}))}
                      placeholder="Nama Jalan, Gedung, No. Rumah, RT/RW, Patokan..."
                      rows={3}
                      className="w-full p-2 bg-white border border-gray-100 rounded-md outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                    />
                  </div>
                  
                  {!addressDetails.isMain && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={addressDetails.isMain}
                        onChange={(e) => setAddressDetails(prev => ({...prev, isMain: e.target.checked}))}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">Jadikan sebagai alamat utama</span>
                    </label>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-md font-bold shadow-sm hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="addressForm"
                  disabled={isSavingAddress}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
                >
                  {isSavingAddress ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Save className="w-4 h-4" />}
                  Simpan Alamat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
