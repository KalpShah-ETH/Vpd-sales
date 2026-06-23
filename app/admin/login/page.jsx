'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?role=admin');
  }, [router]);
  
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Redirecting to portal login...</p>
    </div>
  );
}
