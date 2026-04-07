import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tenant, UserProfile, ApprovalRequest } from '../types';
import { Users, Building2, ShieldCheck, Activity, Search, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function SuperAdmin() {
  const { profile } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tenants' | 'approvals'>('tenants');

  useEffect(() => {
    const fetchData = async () => {
      const tenantSnap = await getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc')));
      setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));

      const userSnap = await getDocs(collection(db, 'users'));
      setUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    };
    fetchData();

    const unsubApprovals = onSnapshot(query(collection(db, 'approval_requests'), orderBy('requestedAt', 'desc')), (snap) => {
      setApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest)));
      setLoading(false);
    });

    return () => unsubApprovals();
  }, []);

  const updateSubscription = async (tenantId: string, plan: string) => {
    await updateDoc(doc(db, 'tenants', tenantId), { subscription: plan });
    setTenants(tenants.map(t => t.id === tenantId ? { ...t, subscription: plan as any } : t));
  };

  const handleApproval = async (request: ApprovalRequest, action: 'approve' | 'reject') => {
    try {
      const requestRef = doc(db, 'approval_requests', request.id);
      const orderRef = doc(db, 'orders', request.orderId);

      if (action === 'approve') {
        await updateDoc(orderRef, { status: request.targetStatus });
        await updateDoc(requestRef, { 
          status: 'approved',
          resolvedBy: profile?.uid,
          resolvedAt: serverTimestamp()
        });
        alert('Permintaan disetujui dan status pesanan telah diperbarui.');
      } else {
        await updateDoc(requestRef, { 
          status: 'rejected',
          resolvedBy: profile?.uid,
          resolvedAt: serverTimestamp()
        });
        alert('Permintaan ditolak.');
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses permintaan.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Superadmin Dashboard</h2>
          <p className="text-gray-500">Global system management and monitoring.</p>
        </div>
        <div className="flex space-x-4">
          <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2" />
            System Status: Healthy
          </div>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Tenants</p>
            <p className="text-2xl font-bold">{tenants.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
          <div className="p-3 bg-green-100 text-green-600 rounded-lg mr-4">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Sessions</p>
            <p className="text-2xl font-bold">42</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tenants' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Tenants
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'approvals' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Approvals
          {approvals.filter(a => a.status === 'pending').length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">
              {approvals.filter(a => a.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'tenants' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Tenant Management</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tenants..."
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Business Name</th>
                  <th className="px-6 py-4 font-medium">Slug</th>
                  <th className="px-6 py-4 font-medium">Subscription</th>
                  <th className="px-6 py-4 font-medium">Created At</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{tenant.name}</td>
                    <td className="px-6 py-4 text-gray-500">{tenant.slug}</td>
                    <td className="px-6 py-4">
                      <select
                        value={tenant.subscription}
                        onChange={(e) => updateSubscription(tenant.id, e.target.value)}
                        className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 outline-none border-none"
                      >
                        <option value="free">FREE</option>
                        <option value="pro">PRO</option>
                        <option value="enterprise">ENTERPRISE</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {tenant.createdAt ? new Date(tenant.createdAt?.seconds * 1000).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold">Approval Requests</h3>
            <p className="text-sm text-gray-500">Manage requests to revert cancelled transactions.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Order Number</th>
                  <th className="px-6 py-4 font-medium">Requested At</th>
                  <th className="px-6 py-4 font-medium">Target Status</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {approvals.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-600">{req.orderNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {req.requestedAt ? new Date(req.requestedAt?.seconds * 1000).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                        {req.targetStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                        req.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' :
                        req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                        'bg-yellow-50 text-yellow-700 border-yellow-100'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {req.status === 'pending' && (
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleApproval(req, 'approve')}
                            className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproval(req, 'reject')}
                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {req.status !== 'pending' && (
                        <span className="text-xs text-gray-400 italic">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
                {approvals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                      No approval requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
