import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionToken, sessionCookie, verifyAdminCredentials } from '@/lib/auth';
import { originIsSame } from '@/lib/auth';

export const runtime = 'nodejs';
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(500) });

export async function POST(request: Request) {
  if (!originIsSame(request)) return NextResponse.json({ error: 'Request origin haijaruhusiwa.' }, { status: 403 });
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Weka email na password sahihi.' }, { status: 400 });
    if (!verifyAdminCredentials(parsed.data.email, parsed.data.password)) {
      return NextResponse.json({ error: 'Email au password si sahihi.' }, { status: 401 });
    }
    const email = process.env.ADMIN_EMAIL!.trim();
    const response = NextResponse.json({ ok: true, email });
    response.headers.append('Set-Cookie', sessionCookie(createSessionToken(email)));
    return response;
  } catch (error) {
    const message = error instanceof Error && (error.message.includes('must be configured') || error.message.includes('SESSION_SECRET'))
      ? error.message
      : 'Imeshindikana kuingia. Jaribu tena.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
