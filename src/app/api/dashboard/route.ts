import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { getDb } from '@/lib/db';
import { FARM_ID, tanzaniaToday } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!apiAdmin(request)) return jsonError('Tafadhali ingia kwanza.', 401);
  try {
    const sql = getDb();
    const today = tanzaniaToday();
    const [stats] = await sql`
      WITH balances AS (
        SELECT g.id, g.type,
          COALESCE(SUM(CASE WHEN m.movement_type IN ('OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN') THEN m.quantity ELSE -m.quantity END),0)::bigint AS stock
        FROM animal_groups g LEFT JOIN stock_movements m ON m.animal_group_id=g.id AND m.effective_date <= ${today}::date
        WHERE g.farm_id=${FARM_ID} AND g.active=true GROUP BY g.id,g.type
      ), latest_sick AS (
        SELECT DISTINCT ON (l.animal_group_id) l.animal_group_id, l.sick_quantity
        FROM daily_report_lines l JOIN daily_reports r ON r.id=l.report_id
        WHERE r.farm_id=${FARM_ID} AND r.status='FINALIZED' AND r.report_date <= ${today}::date
        ORDER BY l.animal_group_id,r.report_date DESC
      ), recent_reports AS (
        SELECT COUNT(*)::int AS reports_count FROM daily_reports WHERE farm_id=${FARM_ID} AND status='FINALIZED' AND report_date >= (${today}::date - 30)
      )
      SELECT COALESCE(SUM(stock),0)::bigint AS total_stock,
        COALESCE(SUM(stock) FILTER (WHERE type='SHEEP'),0)::bigint AS sheep_count,
        COALESCE(SUM(stock) FILTER (WHERE type='GOAT'),0)::bigint AS goat_count,
        (SELECT COALESCE(SUM(sick_quantity),0)::bigint FROM latest_sick) AS sick_count,
        (SELECT reports_count FROM recent_reports) AS reports_count,
        COUNT(*)::int AS group_count
      FROM balances`;
    const groups = await sql`
      SELECT g.id,g.type,g.breed,g.sex,g.category,g.group_name,g.tip_tag,g.tag_colour,
        COALESCE(SUM(CASE WHEN m.movement_type IN ('OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN') THEN m.quantity ELSE -m.quantity END),0)::bigint AS live_stock,
        g.created_at
      FROM animal_groups g LEFT JOIN stock_movements m ON m.animal_group_id=g.id AND m.effective_date <= ${today}::date
      WHERE g.farm_id=${FARM_ID} AND g.active=true
      GROUP BY g.id ORDER BY g.type,g.group_name,g.breed,g.sex,g.category`;
    const recentReports = await sql`
      SELECT id,report_date,status,created_at,finalized_at FROM daily_reports
      WHERE farm_id=${FARM_ID} ORDER BY report_date DESC LIMIT 8`;
    const recentMovements = await sql`
      SELECT m.id,m.movement_type,m.quantity,m.effective_date,m.external_party,m.notes,m.created_at,
        g.type,g.breed,g.sex,g.category,g.group_name
      FROM stock_movements m JOIN animal_groups g ON g.id=m.animal_group_id
      WHERE m.farm_id=${FARM_ID} ORDER BY m.created_at DESC LIMIT 8`;
    return NextResponse.json({ stats, groups, recentReports, recentMovements, today });
  } catch (error) {
    return jsonError(readableError(error), 500);
  }
}
