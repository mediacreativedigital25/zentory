import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        let profileData: UserProfile | null = null;

        if (profileDoc.exists()) {
          profileData = { uid: user.uid, ...profileDoc.data() } as UserProfile;
          
          // Auto-upgrade to superadmin if email matches
          if (user.email === 'mediacreativedigital25@gmail.com' && profileData.role !== 'superadmin') {
            await updateDoc(doc(db, 'users', user.uid), { role: 'superadmin', tenantId: null });
            profileData.role = 'superadmin';
            profileData.tenantId = null;
          }
        } else if (user.email === 'mediacreativedigital25@gmail.com') {
          // Create missing superadmin profile
          const newProfile = {
            email: user.email,
            displayName: user.displayName || 'Super Admin',
            role: 'superadmin',
            tenantId: null,
            createdAt: new Date(),
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          profileData = { uid: user.uid, ...newProfile } as UserProfile;
        }
        
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
