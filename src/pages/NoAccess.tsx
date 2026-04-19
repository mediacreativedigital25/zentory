import React from 'react';
import { ShieldAlert, Home, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function NoAccess() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center space-y-6 border border-gray-100">
        <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto animate-pulse">
          <ShieldAlert className="w-12 h-12" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Akses Ditolak</h1>
          <p className="text-gray-500 font-medium leading-relaxed">
            Akun Anda tidak terdaftar atau tidak memiliki akses pada domain ini. Domain ini dikhususkan untuk tenant tertentu.
          </p>
        </div>

        <div className="pt-6 space-y-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 group"
          >
            <Home className="w-5 h-5 mr-3 group-hover:-translate-y-0.5 transition-transform" />
            Ke Beranda
          </Link>
          <button
            onClick={() => signOut(auth)}
            className="inline-flex items-center justify-center w-full px-6 py-4 bg-white border-2 border-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-200 transition-all"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Logout Akun
          </button>
        </div>
      </div>
    </div>
  );
}
