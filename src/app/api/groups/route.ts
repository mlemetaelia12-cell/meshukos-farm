import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { originIsSame } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FARM_ID, tanzaniaToday } from '@/lib/config';
import { groupSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!apiAdmin(request)) return jsonError('Tafadhali ingia kwanza.', 401);
  try {
    const sql = getDb();
    const today = tanzaniaToday();
    const rows = await sql`
      SELECT g.id,g.type,g.breed,g.sex,g.category,g.group_name,g.tip_tag,g.tag_colour,g.active,g.created_at,
        COALESCE(SUM(CASE WHEN m.movement_type IN ('OPENING','BIRTH','NEW_STOCK','TRANSFER_IN','ADJUSTMENT_IN') THEN m.quantity ELSE -m.quantity END),0)::bigint AS live_stock
      FROM animal_groups g LEFT JOIN stock_movements m ON m.animal_group_id=g.id AND m.effective_date <= ${today}::date
      WHERE g.farm_id=${FARM_ID} AND g.active=true GROUP BY g.id ORDER BY g.type,g.group_name,g.breed,g.sex,g.category`;
    return NextResponse.json({ groups: rows, today });
  } catch (error) { return jsonError(readableError(error), 500); }
}

export async function POST(request: Request) {
  const email = apiAdmin(request);
  if (!email) return jsonError('Tafadhali ingia kwanza.', 401);
  if (!originIsSame(request)) return jsonError('Request origin haijaruhusiwa.', 403);
  const parsed = groupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Kagua taarifa za kundi.');
  const value = parsed.data;
  try {
    const sql = getDb();
    const openingDate = value.openingDate || tanzaniaToday();
    if (openingDate > tanzaniaToday()) return jsonError('Opening balance date cannot be in the future.');
    const [backdated] = await sql`SELECT EXISTS (SELECT 1 FROM daily_reports WHERE farm_id=${FARM_ID} AND status='FINALIZED' AND report_date > ${openingDate}::date) AS blocked`;
    if (backdated?.blocked) return jsonError('Opening date is earlier than a finalized report. Choose a valid date or review existing report history.', 409);
    const rows = await sql`
      WITH g AS (
        INSERT INTO animal_groups(farm_id,type,breed,sex,category,group_name,tip_tag,tag_colour)
        VALUES(${FARM_ID},${value.type},${value.breed},${value.sex},${value.category},${value.groupName},${value.tipTag},${value.tagColour})
        RETURNING *
      ), opening AS (
        INSERT INTO stock_movements(farm_id,animal_group_id,movement_type,quantity,effective_date,notes,idempotency_key,created_by)
        SELECT ${FARM_ID},id,'OPENING',${value.openingQuantity},(${openingDate}::date), 'Initial opening balance', 'opening:'||id::text, ${email}
        FROM g WHERE ${value.openingQuantity} > 0
        RETURNING id
      ), audit AS (
        INSERT INTO audit_logs(farm_id,actor_email,action,entity_type,entity_id,after_data)
        SELECT ${FARM_ID},${email},'CREATE_GROUP','animal_group',g.id::text,to_jsonb(g) FROM g RETURNING id
      ) SELECT g.id,g.type,g.breed,g.sex,g.category,g.group_name,g.tip_tag,g.tag_colour,g.active FROM g`;
    return NextResponse.json({ group: rows[0] }, { status: 201 });
  } catch (error) { return jsonError(readableError(error), 500); }
}
