import React, { useState, useEffect } from 'react';
import { collection, query, where, setDoc, doc, onSnapshot, serverTimestamp, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { SalesTarget, ApprovalRequest } from '../../types';
import { Target, Save, X, Edit2, Calendar, ShieldCheck, Key, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';

export default function SettingTarget() {
  const { profile } = useAuth();
  const [salesTargets, setSalesTargets] = useState<SalesTarget[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    showCancel?: boolean;
    type?: 'danger' | 'warning' | 'info';
  } | null>(null);
  const getMonthKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date())); // YYYY-MM
  const currentMonthISO = getMonthKey(new Date());
  
  const currentTarget = salesTargets.find(t => t.month === selectedMonth);
  const isMonthLocked = selectedMonth <= currentMonthISO;
  const isUnlockedByAdmin = currentTarget?.isUnlocked === true;
  const isCurrentMonth = selectedMonth === currentMonthISO;
  const revisionCount = currentTarget?.revisionCount || 0;
  
  const hasPendingRequest = pendingRequests.some(r => r.targetMonth === selectedMonth);

  const [formData, setFormData] = useState({
    target1: 0,
    target2: 0,
    target3: 0
  });

  useEffect(() => {
    if (!profile?.tenantId) return;

    const q = query(collection(db, 'sales_targets'), where('tenantId', '==', profile.tenantId));
    const unsubscribe = onSnapshot(q, (snap) => {
      const targets = snap.docs.map(d => ({ id: d.id, ...d.data() } as SalesTarget));
      setSalesTargets(targets);
      setLoading(false);
    });

    const reqQ = query(collection(db, 'approval_requests'), where('tenantId', '==', profile.tenantId), where('type', '==', 'target_revision'));
    const unsubReq = onSnapshot(reqQ, (snap) => {
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest));
      setPendingRequests(reqs);
    });

    return () => {
      unsubscribe();
      unsubReq();
    };
  }, [profile]);

  useEffect(() => {
    if (currentTarget) {
      setFormData({
        target1: currentTarget.target1 || 0,
        target2: currentTarget.target2 || 0,
        target3: currentTarget.target3 || 0
      });
    } else {
      setFormData({
        target1: 0,
        target2: 0,
        target3: 0
      });
    }
  }, [currentTarget, selectedMonth]);

  const handleSave = async () => {
    if (!profile?.tenantId) return;
    if (isMonthLocked && !isUnlockedByAdmin) {
      alert('Maaf, Target untuk bulan berjalan atau bulan yang sudah lewat tidak dapat diubah.');
      return;
    }
    const targetId = `${profile.tenantId}_${selectedMonth}`;
    
    try {
      await setDoc(doc(db, 'sales_targets', targetId), {
        id: targetId,
        tenantId: profile.tenantId,
        month: selectedMonth,
        target1: Number(formData.target1) || 0,
        target2: Number(formData.target2) || 0,
        target3: Number(formData.target3) || 0,
        updatedAt: serverTimestamp(),
        updatedBy: profile.uid,
        isUnlocked: false,
        revisionCount: isUnlockedByAdmin ? revisionCount + 1 : revisionCount
      });
      setIsEditing(false);
      alert(`Target untuk ${new Date(selectedMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} berhasil disimpan!`);
    } catch (err) {
      console.error('Error saving target:', err);
      alert('Gagal menyimpan target.');
    }
  };

  const handleRequestUnlock = async () => {
    if (!profile?.tenantId) return;
    setConfirmConfig({
      isOpen: true,
      title: 'Ajukan Revisi Target',
      message: 'Ajukan pembukaan kunci target ke Super Admin? (Maksimal 2 kali per bulan)',
      type: 'warning',
      onConfirm: async () => {
        setConfirmConfig(null);
        try {
          const tenantDoc = await getDoc(doc(db, 'tenants', profile.tenantId));
          const tenantName = tenantDoc.exists() ? tenantDoc.data().name : 'Unknown Tenant';

          await addDoc(collection(db, 'approval_requests'), {
            tenantId: profile.tenantId,
            tenantName,
            type: 'target_revision',
            targetMonth: selectedMonth,
            requestedBy: profile.uid,
            requestedAt: serverTimestamp()
          });
          setConfirmConfig({
            isOpen: true,
            title: 'Berhasil',
            message: 'Permintaan berhasil diajukan! Menunggu persetujuan Super Admin.',
            showCancel: false,
            type: 'info',
            onConfirm: () => setConfirmConfig(null)
          });
        } catch (err) {
          console.error(err);
          setConfirmConfig({
            isOpen: true,
            title: 'Gagal',
            message: 'Gagal mengajukan permintaan.',
            showCancel: false,
            type: 'danger',
            onConfirm: () => setConfirmConfig(null)
          });
        }
      }
    });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Memuat Setting Target...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center">
            <Target className="w-8 h-8 mr-3 text-indigo-600" />
            Setting Target Penjualan
          </h2>
          <p className="text-gray-500 font-medium">Tentukan target pencapaian bisnis Anda secara manual per bulan.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
          <Calendar className="w-5 h-5 text-gray-400 ml-2" />
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setIsEditing(false);
            }}
            className="bg-transparent border border-gray-200 font-medium text-gray-900 focus:ring-0 outline-none cursor-pointer"
          />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[400px] flex flex-col">
        <div className="p-8 border-b border-gray-50 bg-indigo-50/30 flex justify-between items-center transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Periode Terpilih</p>
              <h3 className="text-xl font-black text-indigo-900">{new Date(selectedMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
            </div>
          </div>
          
          {(!isMonthLocked || isUnlockedByAdmin) && !isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Edit2 className="w-4 h-4" />
              Edit Target {isUnlockedByAdmin && '(Revisi Buka)'}
            </button>
          ) : isEditing ? (
            <div className="flex gap-3">
              <button 
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-2 px-5 py-3 bg-white text-gray-400 rounded-lg font-medium border border-gray-100 hover:text-gray-600 transition-all"
              >
                <X className="w-4 h-4" />
                Batal
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                Simpan Target
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100 italic text-xs font-medium">
                <ShieldCheck className="w-4 h-4" />
                Target terkunci
              </div>
              
              {isMonthLocked && revisionCount < 2 && (
                hasPendingRequest ? (
                  <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 italic text-xs font-medium">
                    <Clock className="w-4 h-4" />
                    Menunggu Approval
                  </div>
                ) : (
                  <button 
                    onClick={handleRequestUnlock}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold shadow-sm hover:bg-red-100 transition-all text-xs"
                  >
                    <Key className="w-4 h-4" />
                    Ajukan Revisi (Sisa {2 - revisionCount}x)
                  </button>
                )
              )}
            </div>
          )}
        </div>

        <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8 flex-1">
          {[
            { label: 'Target Utama (1)', key: 'target1', color: 'text-gray-900', bg: 'bg-gray-50', iconColor: 'text-gray-400' },
            { label: 'Target Menengah (2)', key: 'target2', color: 'text-indigo-600', bg: 'bg-indigo-50', iconColor: 'text-indigo-400' },
            { label: 'Target Maksimal (3)', key: 'target3', color: 'text-amber-600', bg: 'bg-amber-50', iconColor: 'text-amber-400' },
          ].map((t) => (
            <div key={t.key} className={`${t.bg} p-8 rounded-[2rem] border border-transparent hover:border-indigo-100 transition-all flex flex-col justify-between`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.label}</p>
                  <p className="text-xs text-gray-500 font-medium italic">Standard</p>
                </div>
                <ShieldCheck className={`w-5 h-5 ${t.iconColor}`} />
              </div>
              
              {isEditing ? (
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">Rp</span>
                  <input
                    type="text"
                    value={Number(formData[t.key as keyof typeof formData]) > 0 ? Number(formData[t.key as keyof typeof formData]).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                       let val = e.target.value.replace(/\./g, '');
                       val = val.replace(/\D/g, '');
                       setFormData({ ...formData, [t.key]: Number(val) });
                    }}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-indigo-100 rounded-lg text-2xl font-medium text-gray-900 outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              ) : (
                <div>
                  <span className="text-gray-400 font-bold text-lg mr-1">Rp</span>
                  <span className={`text-3xl font-black ${t.color}`}>{Math.round(Number(formData[t.key as keyof typeof formData]) || 0).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="p-8 bg-gray-50/50 border-t border-gray-50 flex items-center gap-4 text-gray-500 text-sm italic">
          <Target className="w-4 h-4" />
          Note: Target yang Anda masukkan akan menjadi acuan grafik pencapaian di menu "Pencapaian".
        </div>
      </div>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
          showCancel={confirmConfig.showCancel}
          type={confirmConfig.type}
        />
      )}
    </div>
  );
}
