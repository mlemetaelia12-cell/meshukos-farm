import { NextResponse } from 'next/server';
import { apiAdmin } from '@/lib/http';

export async function GET(request: Request) {
  const email = apiAdmin(request);
  return NextResponse.json({ authenticated: Boolean(email), email: email ?? null });
}
