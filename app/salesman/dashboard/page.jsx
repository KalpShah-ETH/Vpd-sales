import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import SalesmanDashboardClient from './SalesmanDashboardClient';

export default async function SalesmanDashboardPage() {
  const cookieStore = await cookies();
  const salesman = validateSession(cookieStore, 'salesman_session', 'salesman');

  if (!salesman) {
    redirect('/salesman/login');
  }

  return <SalesmanDashboardClient salesman={salesman} />;
}
