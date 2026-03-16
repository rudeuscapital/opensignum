import type { APIRoute } from 'astro';
import { parseSession } from '../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const session = parseSession(request.headers.get('cookie'));
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const groqKey = process.env.GROQ_API_KEY || import.meta.env.GROQ_API_KEY;
  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'AI engine not configured — contact administrator' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { messages } = await request.json();

    // Retry on rate limit (429) with exponential backoff
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          temperature: 0.5,
          messages: [
            { role: 'system', content: 'You are a helpful trading assistant for Open Signum Copilot. You help users understand markets, trading strategies, technical analysis, risk management, and crypto/forex/stock concepts. Be concise and practical. Format responses with markdown when helpful. Never provide financial advice — always remind users to do their own research.' },
            ...messages,
          ],
        }),
      });
      if (res.status === 429 && attempt < 2) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '0') * 1000;
        await new Promise(r => setTimeout(r, retryAfter || (attempt + 1) * 3000));
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      if (res?.status === 429) {
        return new Response(JSON.stringify({ error: 'AI is busy — please wait a moment and try again' }), {
          status: 429, headers: { 'Content-Type': 'application/json' },
        });
      }
      const e = res ? await res.json().catch(() => ({})) : {};
      throw new Error((e as any).error?.message ?? 'Chat failed');
    }
    const data = await res.json();
    return new Response(JSON.stringify({ content: data.choices[0].message.content }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
