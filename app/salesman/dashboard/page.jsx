import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import SalesmanDashboardClient from './SalesmanDashboardClient';

export default async function SalesmanDashboardPage() {
  const cookieStore = await cookies();
  const salesman = await validateSession(cookieStore, 'salesman_session', 'salesman');

  if (!salesman) {
    redirect('/?role=salesman');
  }

  return <SalesmanDashboardClient salesman={salesman} />;
}
