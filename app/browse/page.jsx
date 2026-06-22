import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth';
import RetailerBrowseClient from './RetailerBrowseClient';

export default async function BrowsePage() {
  const cookieStore = await cookies();
  
  // Verify retailer session, fallback to salesman or admin for testing previews
  const retailer = validateSession(cookieStore, 'retailer_session', 'retailer');
  const salesman = validateSession(cookieStore, 'salesman_session', 'salesman');
  const admin = validateSession(cookieStore, 'admin_session', 'admin');

  if (!retailer && !salesman && !admin) {
    return (
      <div className="loader-container" style={{ padding: '24px' }}>
        <div className="empty-icon" style={{ fontSize: '64px', marginBottom: '8px' }}>🔒</div>
        <h1 style={{ color: 'var(--text-main)', fontSize: '24px', fontWeight: '800', textAlign: 'center' }}>Private Portal</h1>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: '360px', marginTop: '8px', lineHeight: '1.6' }}>
          This ordering platform is private. Please open the unique link sent to your phone via WhatsApp to access stocks.
        </p>
      </div>
    );
  }

  // Set header identity
  const userIdentity = retailer 
    ? retailer.shopName 
    : (salesman ? `${salesman.companyName} (Rep)` : "VPD Admin Mode");

  return <RetailerBrowseClient shopName={userIdentity} />;
}
