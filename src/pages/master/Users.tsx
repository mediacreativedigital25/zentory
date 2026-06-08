import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import firebaseConfig from '../../../firebase-applet-config.json';
import { useAuth } from '../../hooks/useAuth';
import { UserProfile, Role, Tenant } from '../../types';
import { Users as UsersIcon, Plus, X, Edit2, Trash2, Shield, Mail, Building2, LogOut, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../../components/ConfirmModal';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';

export default function Users() {
  const { profile, domainTenantId } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: '',
    tenantId: '',
    password: ''
  });

  const [activeTab, setActiveTab] = useState<'app' | 'customer'>('app');
  const [isGenerating, setIsGenerating] = useState(false);

  const checkIsOnline = (user: UserProfile) => {
    if (!user.isOnline) return false;
    if (!user.lastActive) return true;
    const activeTime = user.lastActive.seconds ? user.lastActive.seconds * 1000 : user.lastActive.toMillis?.() || Date.now();
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    return activeTime > twoMinutesAgo;
  };

  useEffect(() => {
    if (!profile) return;

    // Fetch Roles
    const rolesQ = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'roles'))
      : query(collection(db, 'roles'), where('tenantId', '==', domainTenantId || profile.tenantId));
    
    const unsubRoles = onSnapshot(rolesQ, (snap) => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'roles', auth, profile);
    });

    // Fetch Tenants (for superadmin)
    if (profile.role === 'superadmin') {
      getDocs(collection(db, 'tenants')).then(snap => {
        setTenants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
      }).catch(err => console.error('Tenants Fetch Error:', err));
    }

    // Fetch Users
    const targetTenantId = domainTenantId || profile.tenantId;
    const usersQ = (profile.role === 'superadmin' && !domainTenantId)
      ? query(collection(db, 'users'))
      : targetTenantId 
        ? query(collection(db, 'users'), where('tenantId', '==', targetTenantId))
        : null;

    if (!usersQ) {
      setLoading(false);
      return () => {
        unsubRoles();
      };
    }

    const unsubUsers = onSnapshot(usersQ, (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users', auth, profile);
      setLoading(false);
    });

    return () => {
      unsubRoles();
      unsubUsers();
    };
  }, [profile]);

  const generateUniqueSalesCode = (uid: string): string => {
    // Extract a 4-character chunk from the UID to ensure uniqueness without requiring Firestore permissions
    return uid.substring(0, 4).toUpperCase();
  };

  const generateSalesCodesForAll = async () => {
    if (!profile || profile.role !== 'superadmin') return;
    
    setConfirmConfig({
      isOpen: true,
      title: 'Generate Sales Codes',
      message: 'Apakah Anda yakin ingin men-generate sales code untuk semua user yang belum memilikinya? Proses ini tidak dapat dibatalkan.',
      onConfirm: async () => {
        setIsGenerating(true);
        setConfirmConfig(null);
        try {
          const usersWithoutCode = users.filter(u => !u.salesCode);
          let successCount = 0;
          for (const user of usersWithoutCode) {
            const newCode = generateUniqueSalesCode(user.uid);
            await updateDoc(doc(db, 'users', user.uid), {
              salesCode: newCode
            });
            successCount++;
          }
          alert(`Berhasil generate ${successCount} sales code baru.`);
        } catch (err) {
          console.error(err);
          alert('Gagal generate sales code.');
        } finally {
          setIsGenerating(false);
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const targetTenantId = (profile.role === 'superadmin' && !domainTenantId) 
        ? formData.tenantId 
        : (domainTenantId || profile.tenantId);
      
      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), {
          displayName: formData.displayName,
          role: formData.role,
          tenantId: targetTenantId,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create user in Firebase Auth using a secondary app instance
        // to avoid logging out the current admin
        let secondaryApp;
        try {
          secondaryApp = getApp('Secondary');
        } catch {
          secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        }
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          formData.email, 
          formData.password
        );
        
        const newUid = userCredential.user.uid;
        
        // Sign out from secondary app immediately
        await signOut(secondaryAuth);

        const salesCode = generateUniqueSalesCode(newUid);

        // Create user profile in Firestore
        await setDoc(doc(db, 'users', newUid), {
          uid: newUid,
          email: formData.email,
          displayName: formData.displayName,
          role: formData.role,
          tenantId: targetTenantId,
          salesCode,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ email: '', displayName: '', role: '', tenantId: '', password: '' });
    } catch (err: any) {
      if (!err.code?.startsWith('auth/')) {
        console.error(err);
      }
      let errorMessage = 'Gagal menyimpan user.';
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email ini sudah terdaftar di sistem. Gunakan email lain.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Format email tidak valid.';
      }
      alert(errorMessage);
    }
  };

  const deleteUser = (uid: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hapus User',
      message: 'Apakah Anda yakin ingin menghapus profile user ini? User tidak akan bisa mengakses sistem.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', uid));
          setConfirmConfig(null);
        } catch (err) {
          console.error(err);
          alert('Failed to delete user.');
        }
      }
    });
  };

  const getRoleName = (roleId: string) => {
    if (['superadmin', 'admin', 'staff', 'customer', 'kasir'].includes(roleId)) {
      return roleId.charAt(0).toUpperCase() + roleId.slice(1);
    }
    return roles.find(r => r.id === roleId)?.name || roleId;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manajemen User</h2>
          <p className="text-gray-500">Kelola pengguna dan penetapan role mereka.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {profile?.role === 'superadmin' && (
            <button
              onClick={generateSalesCodesForAll}
              disabled={isGenerating}
              className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate Codes
            </button>
          )}
          <button
            onClick={() => { setEditingUser(null); setFormData({ email: '', displayName: '', role: '', tenantId: '', password: '' }); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-md shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('app')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'app' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            User Aplikasi
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'customer' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            User Pelanggan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">User</th>
                <th className="px-6 py-4 font-medium">Kode Sales</th>
                <th className="px-6 py-4 font-medium">Role</th>
                {profile?.role === 'superadmin' && <th className="px-6 py-4 font-medium">Tenant</th>}
                <th className="px-6 py-4 font-medium">Status & Device</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.filter(u => activeTab === 'app' ? u.role !== 'customer' : u.role === 'customer').map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
                        {user.displayName?.charAt(0) || user.email?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.displayName || 'No Name'}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {user.salesCode || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      user.role === 'superadmin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                      user.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      user.role === 'kasir' ? 'bg-green-50 text-green-700 border-green-100' :
                      'bg-gray-50 text-gray-700 border-gray-100'
                    }`}>
                      {getRoleName(user.role)}
                    </span>
                  </td>
                  {profile?.role === 'superadmin' && (
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900">
                          {tenants.find(t => t.id === user.tenantId)?.name || 'System'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{user.tenantId || 'global'}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    {checkIsOnline(user) ? (
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center text-green-600 text-xs font-bold">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                          ONLINE
                        </span>
                        <span className="text-[10px] text-gray-500">{user.deviceInfo || 'Unknown Device'}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center text-gray-400 text-xs font-bold">
                          <span className="w-2 h-2 bg-gray-400 rounded-full mr-2" />
                          OFFLINE
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {user.lastActive ? new Date(user.lastActive.seconds * 1000).toLocaleString('id-ID', {
                             day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'
                          }) : '-'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setEditingUser(user);
                          setFormData({
                            email: user.email,
                            displayName: user.displayName,
                            role: user.role,
                            tenantId: user.tenantId || '',
                            password: ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.uid !== profile?.uid && (
                        <button
                          onClick={() => {
                            setConfirmConfig({
                              isOpen: true,
                              title: 'Konfirmasi Logout Paksa',
                              message: `Apakah Anda yakin ingin memaksa logout user ${user.displayName || user.email}?`,
                              onConfirm: async () => {
                                try {
                                  await updateDoc(doc(db, 'users', user.uid), {
                                    forceLogoutAt: serverTimestamp()
                                  });
                                  setConfirmConfig(null);
                                } catch (err) {
                                  console.error(err);
                                  setConfirmConfig({
                                    isOpen: true,
                                    title: 'Error',
                                    message: 'Gagal melakukan logout paksa.',
                                    onConfirm: () => setConfirmConfig(null)
                                  });
                                }
                              }
                            });
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Paksa Logout"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      )}
                      {user.uid !== profile?.uid && (
                        <button
                          onClick={() => deleteUser(user.uid)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-md shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-xl font-bold">{editingUser ? 'Edit User' : 'Tambah User Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto auto-rows-max">
                {!editingUser && (
                  <>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-600">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="user@example.com"
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block mb-1 text-xs font-semibold text-gray-600">Password</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Min. 6 karakter"
                        className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full p-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-xs font-semibold text-gray-600">Role</label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                    >
                      <option value="">-- Pilih Role --</option>
                      <optgroup label="System Roles">
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="kasir">Kasir</option>
                        <option value="customer">Customer</option>
                        {profile?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                      </optgroup>
                      <optgroup label="Custom Roles">
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {profile?.role === 'superadmin' && (
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">Tenant</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={formData.tenantId}
                        onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                      >
                        <option value="">System (Global)</option>
                        {tenants.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 p-2 border border-gray-200 rounded-md text-gray-600 font-medium hover:bg-white transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                  >
                    {editingUser ? 'Update' : 'Simpan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </div>
  );
}
