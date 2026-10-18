import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { originIsSame } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FARM_ID } from '@/lib/config';
import { transferSchema } from '@/lib/validation';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!apiAdmin(request)) return jsonError('Tafadhali ingia kwanza.', 401);
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT m.id,m.transfer_id,m.movement_type,m.quantity,m.effective_date,m.external_party,m.notes,m.created_by,m.created_at,
        g.type,g.breed,g.sex,g.category,g.group_name
      FROM stock_movements m JOIN animal_groups g ON g.id=m.animal_group_id
      WHERE m.farm_id=${FARM_ID} AND m.movement_type IN ('TRANSFER_IN','TRANSFER_OUT')
      ORDER BY m.effective_date DESC,m.created_at DESC LIMIT 200`;
    return NextResponse.json({ transfers: rows });
  } catch (error) { return jsonError(readableError(error), 500); }
}

export async function POST(request: Request) {
  const email = apiAdmin(request);
  if (!email) return jsonError('Tafadhali ingia kwanza.', 401);
  if (!originIsSame(request)) return jsonError('Request origin haijaruhusiwa.', 403);
  const parsed = transferSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Kagua taarifa za transfer.');
  try {
    const sql = getDb();
    const v = parsed.data;
    const rows = await sql`SELECT record_farm_transfer(
      ${v.mode},${v.sourceGroupId || null}::uuid,${v.destinationGroupId || null}::uuid,${v.quantity},${v.effectiveDate}::date,
      ${v.externalParty || null},${v.notes || null},${email},${randomUUID()}
    ) AS transfer_id`;
    return NextResponse.json({ ok: true, transferId: rows[0].transfer_id }, { status: 201 });
  } catch (error) { return jsonError(readableError(error), 400); }
}
