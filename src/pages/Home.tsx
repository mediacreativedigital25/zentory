import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Catalog from './Catalog';

export default function Home() {
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isAppDomain = hostname.includes('run.app') || hostname.includes('web.app') || hostname.includes('firebaseapp.com');

    if (!isLocalhost && !isAppDomain) {
      setIsCustomDomain(true);
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  if (isCustomDomain) {
    return <Catalog />;
  }

  return <Navigate to="/dashboard" />;
}
