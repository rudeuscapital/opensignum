import type { APIRoute } from 'astro';
import { generateNonce, storeNonce } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const { address } = await request.json();

  if (!address || typeof address !== 'string') {
    return new Response(JSON.stringify({ error: 'Address required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const nonce = generateNonce();
  storeNonce(address, nonce);

  return new Response(JSON.stringify({ nonce }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
