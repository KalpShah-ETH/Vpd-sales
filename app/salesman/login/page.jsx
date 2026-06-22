'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalesmanLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?role=salesman');
  }, [router]);
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      color: 'var(--text-muted)'
    }}>
      Redirecting to portal login...
    </div>
  );
}
