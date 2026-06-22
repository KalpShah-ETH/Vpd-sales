import Link from 'next/link';

export default function LandingPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
    }}>
      <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚡</div>
        <h1 className="modal-title" style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>
          VPD Order System
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
          Pharma Stock Catalogue & WhatsApp Order Routing Platform.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Link href="/salesman/login" className="btn btn-primary btn-full" style={{ textDecoration: 'none' }}>
            💼 Salesman Login Portal
          </Link>
          <Link href="/admin/login" className="btn btn-secondary btn-full" style={{ textDecoration: 'none' }}>
            🛡️ Admin Login Portal
          </Link>
        </div>

        <div style={{
          marginTop: '32px',
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
    </div>
  );
}
