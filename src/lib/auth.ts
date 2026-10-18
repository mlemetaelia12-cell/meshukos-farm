import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'msfarm_session';
const SESSION_SECONDS = 60 * 60 * 8;

type SessionPayload = { email: string; exp: number; v: 1 };

function sessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters long.');
  return value;
}

function signature(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(email: string): string {
  const payload: SessionPayload = { email, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS, v: 1 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded)}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token) return null;
  try {
    const [encoded, suppliedSignature] = token.split('.');
    if (!encoded || !suppliedSignature) return null;
    const expected = signature(encoded);
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(suppliedSignature);
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.v !== 1 || !payload.email || !Number.isFinite(payload.exp) || payload.exp < Date.now() / 1000) return null;
    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!configuredEmail || payload.email.toLowerCase() !== configuredEmail) return null;
    return payload.email;
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim();
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured in environment variables.');
  if (expectedPassword.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  const emailHash = createHash('sha256').update(email.trim().toLowerCase()).digest();
  const expectedEmailHash = createHash('sha256').update(expectedEmail.toLowerCase()).digest();
  const passwordHash = createHash('sha256').update(password).digest();
  const expectedPasswordHash = createHash('sha256').update(expectedPassword).digest();
  return timingSafeEqual(emailHash, expectedEmailHash) && timingSafeEqual(passwordHash, expectedPasswordHash);
}

export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function cookieTokenFromHeader(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const prefix = `${SESSION_COOKIE}=`;
  const match = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function requestAdminEmail(request: Request): string | null {
  return verifySessionToken(cookieTokenFromHeader(request.headers.get('cookie')));
}

export function originIsSame(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // SameSite cookie is the primary browser CSRF protection.
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
