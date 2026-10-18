import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Farm dashboard' };
export default async function DashboardPage() {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) redirect('/login');
  return <DashboardClient />;
}
