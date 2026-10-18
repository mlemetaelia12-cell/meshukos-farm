export const FARM_ID = '00000000-0000-4000-8000-000000000001';
export const FARM_NAME = "MESHUKO'S S AND G FARM";
export const FARM_WHATSAPP = (process.env.FARM_WHATSAPP || '255783872819').replace(/\D/g, '');
export const BRELL_EMAIL = process.env.BRELL_EMAIL || 'buildwebtz@gmail.com';
export const BRELL_WHATSAPP = (process.env.BRELL_WHATSAPP || '255784452159').replace(/\D/g, '');
export const TIME_ZONE = 'Africa/Dar_es_Salaam';
export function tanzaniaToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
