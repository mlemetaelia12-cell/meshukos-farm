import { NextResponse } from 'next/server';
import { clearSessionCookie, originIsSame } from '@/lib/auth';

export async function POST(request: Request) {
  if (!originIsSame(request)) return NextResponse.json({ error: 'Request origin haijaruhusiwa.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', clearSessionCookie());
  return response;
}
