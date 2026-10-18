import { NextResponse } from 'next/server';
import { apiAdmin, jsonError, readableError } from '@/lib/http';
import { originIsSame } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FARM_ID } from '@/lib/config';
import { z } from 'zod';

export const runtime = 'nodejs';
const editSchema = z.object({ groupName: z.string().trim().min(1).max(100), tipTag: z.string().trim().max(80), tagColour: z.string().trim().max(80), active: z.boolean().optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const email = apiAdmin(request);
  if (!email) return jsonError('Tafadhali ingia kwanza.', 401);
  if (!originIsSame(request)) return jsonError('Request origin haijaruhusiwa.', 403);
  const { id } = await context.params;
  const parsed = editSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Kagua taarifa za kundi.');
  try {
    const sql = getDb();
    const rows = await sql`
      WITH old AS (SELECT to_jsonb(g) AS data FROM animal_groups g WHERE g.id=${id}::uuid AND g.farm_id=${FARM_ID}),
      changed AS (
        UPDATE animal_groups SET group_name=${parsed.data.groupName},tip_tag=${parsed.data.tipTag},tag_colour=${parsed.data.tagColour},active=COALESCE(${parsed.data.active ?? null},active)
        WHERE id=${id}::uuid AND farm_id=${FARM_ID} RETURNING *
      ), audit AS (
        INSERT INTO audit_logs(farm_id,actor_email,action,entity_type,entity_id,before_data,after_data)
        SELECT ${FARM_ID},${email},'UPDATE_GROUP','animal_group',changed.id::text,old.data,to_jsonb(changed) FROM changed,old RETURNING id
      ) SELECT id,type,breed,sex,category,group_name,tip_tag,tag_colour,active FROM changed`;
    if (!rows.length) return jsonError('Kundi halijapatikana.', 404);
    return NextResponse.json({ group: rows[0] });
  } catch (error) { return jsonError(readableError(error), 500); }
}
