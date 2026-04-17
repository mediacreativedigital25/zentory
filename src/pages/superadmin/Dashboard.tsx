import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tenant, UserProfile } from '../../types';
import { Users, Building2, ShieldCheck, Globe } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { auth } from '../../lib/firebase';

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tenantSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, 'tenants'), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, 'users'))
        ]);
        setTenants(tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
        setUsers(userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'dashboard_stats', auth, profile);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Superadmin Dashboard</h2>
        <p className="text-gray-500">Global system management and monitoring.</p>
      </div>

      <div className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center w-fit">
        <ShieldCheck className="w-5 h-5 mr-2" />
        System Status: Healthy
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => navigate('/superadmin/tenants')}
        >
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Tenants</p>
            <p className="text-2xl font-bold">{tenants.length}</p>
          </div>
        </div>
        <div 
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => navigate('/superadmin/users')}
        >
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate('/superadmin/domains')}>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg mr-4">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Custom Domains</p>
            <p className="text-2xl font-bold">Manage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
