'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function RetailerTokenPage() {
  const router = useRouter();
  const { token } = useParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function verifyDevice() {
      try {
        const localKey = localStorage.getItem(`vpd_device_key_${token}`);
        const res = await fetch('/api/retailer/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, deviceKey: localKey })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          if (data.newDeviceKey) {
            localStorage.setItem(`vpd_device_key_${token}`, data.newDeviceKey);
          }
          router.push('/browse');
        } else {
          setError(data.error || 'Device verification failed.');
        }
      } catch (err) {
        console.error(err);
        setError('Connection error. Please check your internet connection.');
      }
    }

    if (token) {
      verifyDevice();
    }
  }, [token, router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary, #f8fafc)',
      color: 'var(--text-main, #0f172a)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        padding: '40px 24px',
        borderRadius: '16px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center'
      }}>
        {error ? (
          <div>
            <div style={{ fontSize: '54px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 12px 0' }}>Access Denied</h1>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
              {error}
            </p>
          </div>
        ) : (
          <div>
            <div className="spinner" style={{ width: '48px', height: '48px', borderWidth: '4px', borderTopColor: 'var(--primary, #2563eb)', margin: '0 auto 20px auto' }}></div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0' }}>Verifying Device...</h1>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '14px', margin: 0 }}>
              Connecting securely to your private ordering session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
