import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface BrandSettings {
  faviconUrl: string;
  headerLogoUrl: string;
  loginImageUrl: string;
  appName: string;
}

const defaultBrand: BrandSettings = {
  faviconUrl: 'https://storage.googleapis.com/aistudio-production-bucket-12/1748962804245-Zyvora_App_Icon_Large.png',
  headerLogoUrl: 'https://storage.googleapis.com/aistudio-production-bucket-12/1748962804245-Zyvora_Landscape_NoBG_Medium.png',
  loginImageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80',
  appName: 'Zyvora'
};

export const useBrand = () => {
  const [brand, setBrand] = useState<BrandSettings>(defaultBrand);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'brand'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as BrandSettings;
        setBrand(prev => ({ ...prev, ...data }));
        
        // Dynamically update document title and favicon
        if (data.appName) {
          document.title = `${data.appName} | One Platform for Every Business`;
        }
        if (data.faviconUrl) {
          let iconLinks = document.querySelectorAll("link[rel~='icon']");
          iconLinks.forEach(link => {
            (link as HTMLLinkElement).href = data.faviconUrl;
          });
          
          let appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
          if (appleTouchIcon) {
            (appleTouchIcon as HTMLLinkElement).href = data.faviconUrl;
          }
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching brand settings:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { brand, loading };
};
