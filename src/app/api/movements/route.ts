import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { getDb } from '@/lib/db';
import { FARM_ID } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!apiAdmin(request)) return jsonError('Tafadhali ingia kwanza.', 401);
  try {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('from');
    const dateTo = url.searchParams.get('to');
    const sql = getDb();
    const rows = await sql`
      SELECT m.id,m.movement_type,m.quantity,m.effective_date,m.external_party,m.reference,m.notes,m.created_by,m.created_at,m.transfer_id,
        g.type,g.breed,g.sex,g.category,g.group_name
      FROM stock_movements m JOIN animal_groups g ON g.id=m.animal_group_id
      WHERE m.farm_id=${FARM_ID}
        AND (${dateFrom}::date IS NULL OR m.effective_date >= ${dateFrom}::date)
        AND (${dateTo}::date IS NULL OR m.effective_date <= ${dateTo}::date)
      ORDER BY m.effective_date DESC,m.created_at DESC LIMIT 500`;
    return NextResponse.json({ movements: rows });
  } catch (error) { return jsonError(readableError(error), 500); }
}
