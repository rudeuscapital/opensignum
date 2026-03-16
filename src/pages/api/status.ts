import type { APIRoute } from 'astro';
import { parseSession } from '../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const session = parseSession(request.headers.get('cookie'));
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    groq: !!(process.env.GROQ_API_KEY || import.meta.env.GROQ_API_KEY),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
