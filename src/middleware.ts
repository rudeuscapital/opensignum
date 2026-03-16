import { defineMiddleware } from 'astro:middleware';
import { parseSession } from './lib/auth';

export const onRequest = defineMiddleware(async ({ request, url, locals, redirect }, next) => {
  const session = parseSession(request.headers.get('cookie'));

  // Attach session to locals for use in pages
  (locals as any).session = session;

  // Protect /app/* routes
  if (url.pathname.startsWith('/app')) {
    if (!session) {
      return redirect('/auth/login');
    }
  }

  // Redirect logged-in users away from login page
  if (url.pathname === '/auth/login' && session) {
    return redirect('/app');
  }

  return next();
});
