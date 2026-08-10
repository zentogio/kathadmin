// Deliberately simple session auth for a one-person admin — no user table,
// no database. Credentials come from env vars; the session is a signed
// cookie (HMAC over username + issue time), not a JWT library, to keep
// this dependency-free for a first draft. Swap for real auth (Supabase
// Auth, etc.) once this is wired to a shared backend.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'kath_admin_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
	const secret = import.meta.env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET is not set — check .env');
	return secret;
}

function sign(value: string): string {
	return createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function createSessionToken(username: string): string {
	const payload = `${username}.${Date.now()}`;
	const encodedPayload = Buffer.from(payload, 'utf-8').toString('base64url');
	return `${encodedPayload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
	if (!token) return null;
	const [encodedPayload, signature] = token.split('.');
	if (!encodedPayload || !signature) return null;

	let payload: string;
	try {
		payload = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
	} catch {
		return null;
	}

	const expected = sign(payload);
	const actualBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
		return null;
	}

	const separatorIndex = payload.lastIndexOf('.');
	if (separatorIndex === -1) return null;
	const username = payload.slice(0, separatorIndex);
	const issuedAt = Number(payload.slice(separatorIndex + 1));
	if (!username || !issuedAt || Date.now() - issuedAt > SESSION_MAX_AGE_MS) return null;

	return username;
}

export function checkCredentials(username: string, password: string): boolean {
	const adminUser = import.meta.env.ADMIN_USER;
	const adminPassword = import.meta.env.ADMIN_PASSWORD;
	if (!adminUser || !adminPassword) return false;
	return username === adminUser && password === adminPassword;
}
