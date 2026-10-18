import { NextResponse } from 'next/server';
import { requestAdminEmail } from '@/lib/auth';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiAdmin(request: Request): string | null {
  return requestAdminEmail(request);
}

export function readableError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.replace(/^error:\s*/i, '');
    if (message.length < 260 && !message.toLowerCase().includes('sql') && !message.toLowerCase().includes('postgres')) return message;
  }
  return 'Kuna tatizo limetokea. Kagua taarifa ulizoingiza kisha ujaribu tena.';
}
