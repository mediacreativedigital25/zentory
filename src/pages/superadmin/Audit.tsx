import React, { useState, useEffect } from 'react';
import { collection, query, limit, getDocs, getCountFromServer, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { ShieldCheck, Activity, Database, Users, Building2, Package, ServerCrash, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AuditStatus {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string;
  count?: number;
}

export default function SuperAdminAudit() {
  const [dbConnection, setDbConnection] = useState<AuditStatus>({ status: 'idle', message: 'Ready' });
  const [collectionsStatus, setCollectionsStatus] = useState<Record<string, AuditStatus>>({
    tenants: { status: 'idle', message: 'Ready' },
    users: { status: 'idle', message: 'Ready' },
    roles: { status: 'idle', message: 'Ready' },
    products: { status: 'idle', message: 'Ready' },
    orders: { status: 'idle', message: 'Ready' }
  });
  const [configStatus, setConfigStatus] = useState<AuditStatus>({ status: 'idle', message: 'Ready' });
  
  const [isAuditing, setIsAuditing] = useState(false);

  const runAudit = async () => {
    setIsAuditing(true);
    
    // 1. Connection Check
    setDbConnection({ status: 'running', message: 'Checking Database Connection...' });
    try {
      await getDocs(query(collection(db, 'users'), limit(1)));
      setDbConnection({ status: 'success', message: 'Connected to Firestore' });
    } catch (e: any) {
      setDbConnection({ status: 'error', message: e.message || 'Connection failed' });
      setIsAuditing(false);
      return;
    }

    // 2. Collections Count Check
    const cols = ['tenants', 'users', 'roles', 'products', 'orders'];
    for (const col of cols) {
      setCollectionsStatus(prev => ({ ...prev, [col]: { status: 'running', message: `Counting ${col}...` } }));
      try {
        const snap = await getCountFromServer(collection(db, col));
        setCollectionsStatus(prev => ({
          ...prev,
          [col]: { status: 'success', message: 'OK', count: snap.data().count }
        }));
      } catch (e: any) {
        setCollectionsStatus(prev => ({
          ...prev,
          [col]: { status: 'error', message: e.message || `Failed to read ${col}` }
        }));
      }
    }

    // 3. Configurations Check (Checking Superadmin role & Global Settings)
    setConfigStatus({ status: 'running', message: 'Checking Core Configurations...' });
    try {
      const saRole = await getDoc(doc(db, 'roles', 'superadmin'));
      if (!saRole.exists()) {
         setConfigStatus({ status: 'error', message: 'Missing Superadmin role doc!' });
      } else {
         setConfigStatus({ status: 'success', message: 'Core Configurations Intact' });
      }
    } catch (e: any) {
      setConfigStatus({ status: 'error', message: e.message || 'Config check failed' });
    }

    setIsAuditing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <ServerCrash className="w-5 h-5 text-rose-500" />;
      default:
        return <Activity className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-900 tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            System Audit & Health
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Verifikasi koneksi database, integritas koleksi, dan rule keamanan secara realtime.
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={isAuditing}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isAuditing ? 'Auditing...' : 'Run Full Audit'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Connectivity */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Database Connection</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md border border-slate-100">
            <div>
              <p className="font-medium text-slate-800">Firestore Access</p>
              <p className="text-xs text-slate-500">{dbConnection.message}</p>
            </div>
            {getStatusIcon(dbConnection.status)}
          </div>
          
          <div className="mt-6 flex items-center gap-2 mb-4 border-t pt-6">
            <Activity className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Core Constants</h2>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-md border border-slate-100">
            <div>
              <p className="font-medium text-slate-800">Security Roles & Configurations</p>
              <p className="text-xs text-slate-500">{configStatus.message}</p>
            </div>
            {getStatusIcon(configStatus.status)}
          </div>
        </motion.div>

        {/* Collections Integrity */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg border border-slate-200 shadow-sm p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Collections Summary</h2>
          </div>
          <div className="space-y-3">
            {(Object.entries(collectionsStatus) as [string, AuditStatus][]).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-100">
                <div className="flex items-center gap-3">
                  {key === 'users' && <Users className="w-4 h-4 text-slate-400" />}
                  {key === 'tenants' && <Building2 className="w-4 h-4 text-slate-400" />}
                  {['roles', 'products', 'orders'].includes(key) && <Package className="w-4 h-4 text-slate-400" />}
                  <div>
                    <p className="font-medium text-slate-800 capitalize">{key}</p>
                    <p className="text-xs text-slate-500">{status.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {status.count !== undefined && (
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {status.count.toLocaleString()} docs
                    </span>
                  )}
                  {getStatusIcon(status.status)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
