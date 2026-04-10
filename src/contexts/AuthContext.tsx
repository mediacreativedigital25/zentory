import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, Tenant } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  currentTenant: Tenant | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isCashier: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detectTenant = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const tenantSlug = searchParams.get('tenant');

        if (tenantSlug) {
          const q = query(collection(db, 'tenants'), where('subdomain', '==', tenantSlug));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setCurrentTenant({ id: snap.docs[0].id, ...snap.docs[0].data() } as Tenant);
          }
        }
      } catch (error) {
        console.error('Error detecting tenant:', error);
      }
    };

    detectTenant();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // If profile doesn't exist, it might be a new user or a superadmin
            // We'll handle this in the value object
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await auth.signOut();
  };

  const isSuperAdmin = profile?.role === 'SuperAdmin' || user?.email === 'mediacreativedigital25@gmail.com';
  const isAdmin = profile?.role === 'Administrator';
  const isManager = profile?.role === 'Manager';
  const isCashier = profile?.role === 'Cashier';
  const isStaffRole = profile?.role === 'Staff';
  const isCustomer = profile?.role === 'Customer';

  const value = {
    user,
    profile,
    loading,
    currentTenant,
    isSuperAdmin,
    isAdmin,
    isManager,
    isCashier,
    isCustomer,
    isStaff: isSuperAdmin || isAdmin || isManager || isCashier || isStaffRole,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
