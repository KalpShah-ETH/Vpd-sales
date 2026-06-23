'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalesmanLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?role=salesman');
  }, [router]);
  
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <p style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Redirecting to portal login...</p>
    </div>
  );
}
