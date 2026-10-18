import { z } from 'zod';

export const groupSchema = z.object({
  type: z.enum(['SHEEP', 'GOAT']),
  breed: z.string().trim().min(1).max(100),
  sex: z.enum(['MALE', 'FEMALE', 'MIXED']),
  category: z.string().trim().min(1).max(80),
  groupName: z.string().trim().min(1).max(100).default('MAIN HERD'),
  tipTag: z.string().trim().max(80).default(''),
  tagColour: z.string().trim().max(80).default(''),
  openingQuantity: z.coerce.number().int().min(0).max(1000000).default(0),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const reportLineSchema = z.object({
  animal_group_id: z.string().uuid(),
  born_quantity: z.coerce.number().int().min(0).max(1000000).default(0),
  newborn_male_quantity: z.coerce.number().int().min(0).max(1000000).default(0),
  newborn_female_quantity: z.coerce.number().int().min(0).max(1000000).default(0),
  new_stock_quantity: z.coerce.number().int().min(0).max(1000000),
  lost_quantity: z.coerce.number().int().min(0).max(1000000),
  mortality_quantity: z.coerce.number().int().min(0).max(1000000),
  sold_quantity: z.coerce.number().int().min(0).max(1000000),
  slaughter_quantity: z.coerce.number().int().min(0).max(1000000),
  sick_quantity: z.coerce.number().int().min(0).max(1000000)
});

export const transferSchema = z.object({
  mode: z.enum(['INTERNAL', 'EXTERNAL_IN', 'EXTERNAL_OUT']),
  sourceGroupId: z.string().uuid().optional().nullable(),
  destinationGroupId: z.string().uuid().optional().nullable(),
  quantity: z.coerce.number().int().positive().max(1000000),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  externalParty: z.string().trim().max(180).optional().default(''),
  notes: z.string().trim().max(1000).optional().default('')
}).superRefine((value, ctx) => {
  if (value.mode === 'INTERNAL' && (!value.sourceGroupId || !value.destinationGroupId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Chagua source na destination group kwa internal transfer.' });
  if (value.mode === 'EXTERNAL_OUT' && !value.sourceGroupId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Chagua kundi linalotoa mifugo.' });
  if (value.mode === 'EXTERNAL_IN' && !value.destinationGroupId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Chagua kundi linalopokea mifugo.' });
  if (value.mode !== 'INTERNAL' && !value.externalParty) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Jaza jina la shamba/chanzo/destination ya nje.' });
});
