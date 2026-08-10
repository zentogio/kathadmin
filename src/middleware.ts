import { defineMiddleware } from 'astro:middleware';
import { verifySessionToken, SESSION_COOKIE } from './lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/login']);

export const onRequest = defineMiddleware((context, next) => {
	const { pathname } = context.url;
	if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/_astro') || pathname.startsWith('/favicon')) {
		return next();
	}

	const token = context.cookies.get(SESSION_COOKIE)?.value;
	const username = verifySessionToken(token);

	if (!username) {
		return context.redirect('/login');
	}

	context.locals.adminUser = username;
	return next();
});
