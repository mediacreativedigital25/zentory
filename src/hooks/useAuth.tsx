import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  permissions: string[];
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, permissions: [], loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const initialForceLogoutAt = useRef<any>(undefined);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeRole: (() => void) | null = null;

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

      if (user) {
        // Initial check and auto-upgrade
        const profileRef = doc(db, 'users', user.uid);
        
        // Update lastLoginAt and isOnline
        updateDoc(profileRef, {
          lastLoginAt: serverTimestamp(),
          isOnline: true
        }).catch(err => console.error("Failed to update login status", err));

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

            // Fetch permissions if custom role
            if (!['superadmin', 'admin', 'staff', 'customer'].includes(data.role)) {
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
        setProfile(null);
        setPermissions([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeRole) unsubscribeRole();
      window.removeEventListener('beforeunload', handleOffline);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
