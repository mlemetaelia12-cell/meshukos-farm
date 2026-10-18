import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { originIsSame } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FARM_ID, tanzaniaToday } from '@/lib/config';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const createSchema = z.object({ reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function GET(request: Request) {
  if (!apiAdmin(request)) return jsonError('Tafadhali ingia kwanza.', 401);
  try {
    const sql = getDb();
    const rows = await sql`SELECT id,report_date,status,created_by,finalized_by,created_at,finalized_at FROM daily_reports WHERE farm_id=${FARM_ID} ORDER BY report_date DESC LIMIT 100`;
    return NextResponse.json({ reports: rows, today: tanzaniaToday() });
  } catch (error) { return jsonError(readableError(error), 500); }
}

export async function POST(request: Request) {
  const email = apiAdmin(request);
  if (!email) return jsonError('Tafadhali ingia kwanza.', 401);
  if (!originIsSame(request)) return jsonError('Request origin haijaruhusiwa.', 403);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Weka tarehe halali ya ripoti.');
  if (parsed.data.reportDate > tanzaniaToday()) return jsonError('Tarehe ya ripoti haiwezi kuwa mbele ya leo.');
  try {
    const sql = getDb();
    const groupCheck = await sql`SELECT COUNT(*)::int AS group_count FROM animal_groups WHERE farm_id=${FARM_ID} AND active=true AND created_at::date <= ${parsed.data.reportDate}::date`;
    if (Number(groupCheck[0]?.group_count || 0) < 1) return jsonError('Ongeza angalau livestock group na opening quantity/records kabla ya kuunda daily report.', 409);
    const rows = await sql`
      WITH r AS (
        INSERT INTO daily_reports(farm_id,report_date,created_by)
        VALUES(${FARM_ID},${parsed.data.reportDate}::date,${email})
        ON CONFLICT (farm_id,report_date) DO UPDATE SET report_date=EXCLUDED.report_date
          WHERE daily_reports.status='DRAFT'
        RETURNING id,report_date,status
      ), l AS (
        INSERT INTO daily_report_lines(report_id,animal_group_id)
        SELECT r.id,g.id FROM r JOIN animal_groups g ON g.farm_id=${FARM_ID} AND g.active AND g.created_at::date <= r.report_date
        ON CONFLICT (report_id,animal_group_id) DO NOTHING
        RETURNING id
      ) SELECT r.id,r.report_date,r.status FROM r`;
    if (!rows.length) return jsonError('Ripoti ya tarehe hii haipo kwenye hali ya draft; haiwezi kufunguliwa kwa kuhariri.', 409);
    return NextResponse.json({ report: rows[0] }, { status: 201 });
  } catch (error) { return jsonError(readableError(error), 500); }
}
