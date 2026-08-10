import type { APIRoute } from 'astro';
import { checkCredentials, createSessionToken, SESSION_COOKIE } from '../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const form = await request.formData();
	const username = String(form.get('username') ?? '');
	const password = String(form.get('password') ?? '');

	if (!checkCredentials(username, password)) {
		return redirect('/login?error=1');
	}

	const token = createSessionToken(username);
	cookies.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 7,
	});

	return redirect('/');
};
