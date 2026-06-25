import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSessionFast } from '@/lib/auth';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const admin = validateSessionFast(cookieStore, 'admin_session', 'admin');
  
  if (!admin) {
    redirect('/?role=admin');
  }

  return <AdminDashboardClient />;
}
