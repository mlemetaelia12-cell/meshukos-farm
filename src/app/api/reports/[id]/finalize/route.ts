import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { originIsSame } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = apiAdmin(request);
  if (!email) return jsonError('Tafadhali ingia kwanza.', 401);
  if (!originIsSame(request)) return jsonError('Request origin haijaruhusiwa.', 403);
  const { id } = await context.params;
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM finalize_daily_report(${id}::uuid,${email})`;
    if (!rows.length) return jsonError('Ripoti haikuweza kufinalishwa.', 400);
    return NextResponse.json({ ok: true, result: rows[0] });
  } catch (error) { return jsonError(readableError(error), 400); }
}
