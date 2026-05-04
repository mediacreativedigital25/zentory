import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, Tenant } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  tenant: Tenant | null;
  domainTenantId: string | null;
  permissions: string[];
  loading: boolean;
  isSessionExpired: boolean;
  setIsSessionExpired: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  tenant: null,
  domainTenantId: null,
  permissions: [], 
  loading: true,
  isSessionExpired: false,
  setIsSessionExpired: () => {}
});

export const AuthProvider = ({ children, domainTenantId }: { children: React.ReactNode; domainTenantId: string | null }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const initialForceLogoutAt = useRef<any>(undefined);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeRole: (() => void) | null = null;
    let unsubscribeTenant: (() => void) | null = null;
    let pingInterval: NodeJS.Timeout | null = null;

    // Inactivity Logout Logic
    let inactivityTimeout: NodeJS.Timeout | null = null;
    const INACTIVITY_LIMIT = 5 * 60 * 60 * 1000; // 5 Hours

    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      if (auth.currentUser && !isSessionExpired) {
        inactivityTimeout = setTimeout(() => {
          setIsSessionExpired(true);
        }, INACTIVITY_LIMIT);
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const handleOffline = () => {
      if (auth.currentUser) {
        const profileRef = doc(db, 'users', auth.currentUser.uid);
        updateDoc(profileRef, {
          isOnline: false,
          lastLogoutAt: serverTimestamp()
        });
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      initialForceLogoutAt.current = undefined;
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (unsubscribeRole) {
        unsubscribeRole();
        unsubscribeRole = null;
      }
      
      // Cleanup tenant listener
      if (unsubscribeTenant) {
        unsubscribeTenant();
        unsubscribeTenant = null;
      }

      const fetchIpAddress = async () => {
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          return data.ip;
        } catch (e) {
          return null;
        }
      };

      if (user) {
        // Start inactivity timer
        resetInactivityTimer();
        activityEvents.forEach(event => window.addEventListener(event, resetInactivityTimer));

        // Initial check and auto-upgrade
        const profileRef = doc(db, 'users', user.uid);
        
        fetchIpAddress().then(ip => {
          // Update lastLoginAt and isOnline
          updateDoc(profileRef, {
            lastLoginAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            isOnline: true,
            ...(ip ? { ipAddress: ip } : {})
          }).catch(err => console.error("Failed to update login status", err));
          
          // Setup Ping interval every 60 seconds to keep online status
          pingInterval = setInterval(() => {
            updateDoc(profileRef, {
              lastActive: serverTimestamp(),
              isOnline: true
            }).catch(() => {}); // silent fail for ping
          }, 60000);
        });

        window.addEventListener('beforeunload', handleOffline);

        const profileDoc = await getDoc(profileRef);
        
        if (profileDoc.exists()) {
          const data = profileDoc.data();
          if (user.email === 'mediacreativedigital25@gmail.com' && data.role !== 'superadmin') {
            await updateDoc(profileRef, { role: 'superadmin', tenantId: null });
          }
        } else if (user.email === 'mediacreativedigital25@gmail.com') {
          await setDoc(profileRef, {
            email: user.email,
            displayName: user.displayName || 'Super Admin',
            role: 'superadmin',
            tenantId: null,
            createdAt: new Date(),
          });
        }

        // Real-time profile listener
        unsubscribeProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            
            // Check for force logout using change detection
            if (initialForceLogoutAt.current === undefined) {
              initialForceLogoutAt.current = data.forceLogoutAt || null;
            } else {
              const currentForceLogout = data.forceLogoutAt ? 
                (data.forceLogoutAt.seconds || new Date(data.forceLogoutAt).getTime()) : null;
              const initialForceLogout = initialForceLogoutAt.current ? 
                (initialForceLogoutAt.current.seconds || new Date(initialForceLogoutAt.current).getTime()) : null;

              if (currentForceLogout !== initialForceLogout) {
                signOut(auth);
                return;
              }
            }
            
            setProfile({ uid: snap.id, ...data });

            // Fetch Tenant Data
            // If we are on a custom domain, force use of domainTenantId for context
            // unless the user is a superadmin visiting NO specific domain (not possible if domainTenantId is set)
            const targetTenantId = domainTenantId || data.tenantId;

            if (targetTenantId) {
              if (unsubscribeTenant) unsubscribeTenant();
              unsubscribeTenant = onSnapshot(doc(db, 'tenants', targetTenantId), (tenantSnap) => {
                if (tenantSnap.exists()) {
                  setTenant({ id: tenantSnap.id, ...tenantSnap.data() } as Tenant);
                } else {
                  setTenant(null);
                }
              });
            } else {
              setTenant(null);
            }

            // Fetch permissions if custom role
            if (!['superadmin', 'admin', 'staff', 'customer', 'kasir'].includes(data.role)) {
              if (unsubscribeRole) unsubscribeRole();
              unsubscribeRole = onSnapshot(doc(db, 'roles', data.role), (roleSnap) => {
                if (roleSnap.exists()) {
                  setPermissions(roleSnap.data().permissions || []);
                } else {
                  setPermissions([]);
                }
                setLoading(false);
              });
            } else {
              setPermissions([]);
              setLoading(false);
            }
          } else {
            setProfile(null);
            setPermissions([]);
            setLoading(false);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`, auth);
          setLoading(false);
        });
      } else {
        // Cleanup inactivity timer if logged out
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        if (pingInterval) clearInterval(pingInterval);
        activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));

        setProfile(null);
        setTenant(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRole) unsubscribeRole();
      if (unsubscribeTenant) unsubscribeTenant();
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      if (pingInterval) clearInterval(pingInterval);
      activityEvents.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, [domainTenantId]);

  return (
    <AuthContext.Provider value={{ user, profile, tenant, domainTenantId, permissions, loading, isSessionExpired, setIsSessionExpired }}>
      {children}
      
      {/* Session Expired Alert */}
      {isSessionExpired && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-10 text-center">
              <div className="w-24 h-24 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-600 mx-auto mb-8 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Sesi Berakhir</h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-10">
                Anda telah tidak aktif selama lebih dari 5 jam. Demi keamanan, sesi Anda telah berakhir. Silakan login kembali.
              </p>
              <button
                onClick={() => {
                  setIsSessionExpired(false);
                  signOut(auth);
                }}
                className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98]"
              >
                LOGIN KEMBALI
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
