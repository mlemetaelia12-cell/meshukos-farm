import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import ReportEditor from '@/components/ReportEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daily stock report' };
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value)) redirect('/login');
  const { id } = await params;
  return <ReportEditor reportId={id} />;
}
