import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialForceLogoutAt = useRef<any>(undefined);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      initialForceLogoutAt.current = undefined;
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        // Initial check and auto-upgrade
        const profileRef = doc(db, 'users', user.uid);
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
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`, auth);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
