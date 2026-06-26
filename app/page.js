'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine initial role from query parameters
  const [role, setRole] = useState('salesman');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Non-blocking ping call to wake up database compute node while user is on the login page
    fetch('/api/ping').catch(() => {});

    const roleParam = searchParams.get('role');
    if (roleParam === 'admin' || roleParam === 'salesman') {
      setRole(roleParam);
    }
    const logoutParam = searchParams.get('logout');
    if (logoutParam === 'success') {
      setSuccess('Logged out successfully');
      // Clean url from query params to avoid showing on refresh
      router.replace(`/?role=${roleParam || 'salesman'}`);
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    }
  }, [searchParams, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const loginApiEndpoint = role === 'admin' ? '/api/admin/login' : '/api/salesman/login';
    const redirectDashboard = role === 'admin' ? '/admin/dashboard?login=success' : '/salesman/dashboard?login=success';

    if (role === 'salesman') {
      const cleanPhone = username.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        setError('Phone number must be exactly 10 digits');
        setLoading(false);
        setTimeout(() => {
          setError('');
        }, 3000);
        return;
      }
    }

    try {
      const res = await fetch(loginApiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push(redirectDashboard);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setTimeout(() => {
        setError('');
      }, 3000);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: 'var(--bg-primary)'
    }}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="modal-title" style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
            VPD Order System
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Select role and sign in to continue
          </p>
        </div>

        {/* Segmented Role Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-primary)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setRole('salesman');
              setError('');
            }}
            style={{
              flex: 1,
              minHeight: '48px',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: role === 'salesman' ? 'var(--bg-card)' : 'transparent',
              color: role === 'salesman' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontSize: '14px',
              boxShadow: role === 'salesman' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            💼 Salesman
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setRole('admin');
              setError('');
            }}
            style={{
              flex: 1,
              minHeight: '48px',
              padding: '10px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: role === 'admin' ? 'var(--bg-card)' : 'transparent',
              color: role === 'admin' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontSize: '14px',
              boxShadow: role === 'admin' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            🛡️ Admin
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '14px',
            marginBottom: '16px',
            fontWeight: 500,
            border: '1px solid var(--danger)'
          }}>
            {error}
          </div>
        )}



        <form onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              {role === 'admin' ? 'Username' : 'WhatsApp Phone Number'}
            </label>
            <input
              type={role === 'admin' ? 'text' : 'tel'}
              id="username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              placeholder={role === 'admin' ? 'Enter admin username' : 'Enter registered phone number'}
              autoComplete="username"
            />
          </div>
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="form-input"
                style={{ width: '100%', paddingRight: '48px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  color: 'var(--text-muted)'
                }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? 'Signing in...' : `Sign In as ${role === 'admin' ? 'Admin' : 'Salesman'}`}
          </button>
        </form>

        <div style={{
          padding: '16px',
          backgroundColor: 'var(--primary-light)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          textAlign: 'left'
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--primary)', marginBottom: '6px' }}>
            Are you a Retailer?
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            Retailers do not need a password. Please tap the **unique private link** sent to your phone via WhatsApp to auto-authenticate and browse stocks instantly.
          </p>
        </div>
      </div>

      {/* TOAST POPUP NOTIFICATION */}
      {success && (
        <div className="toast">
          <span>✓</span> {success}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
