import type { APIRoute } from 'astro';
import {
  verifySiweMessage,
  verifySolanaSignature,
  consumeNonce,
  createSessionCookie,
  type Chain,
} from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const chain: Chain = body.chain || 'evm';

    let session;

    if (chain === 'solana') {
      // Solana: { message, signature (base64), address, chain: 'solana' }
      const { message, signature, address } = body;
      if (!message || !signature || !address) {
        return new Response(JSON.stringify({ error: 'Message, signature, and address required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      session = verifySolanaSignature(message, signature, address);

      // Verify nonce was issued by us
      const storedNonce = consumeNonce(address);
      if (!storedNonce) {
        return new Response(JSON.stringify({ error: 'Invalid or expired nonce' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // EVM: { message (SIWE string), signature }
      const { message, signature } = body;
      if (!message || !signature) {
        return new Response(JSON.stringify({ error: 'Message and signature required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      session = await verifySiweMessage(message, signature);

      const storedNonce = consumeNonce(session.address);
      if (!storedNonce) {
        return new Response(JSON.stringify({ error: 'Invalid or expired nonce' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const cookie = createSessionCookie(session);

    return new Response(
      JSON.stringify({ success: true, address: session.address, chain: session.chain }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
