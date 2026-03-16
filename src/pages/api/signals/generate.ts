import type { APIRoute } from 'astro';
import { parseSession } from '../../../lib/auth';
import {
  fetchTicker, fetchOHLC,
  computeRSI, computeMACD, computeBollinger, computeEMA,
  formatPrice,
  type AssetClass,
} from '../../../lib/api';

export const POST: APIRoute = async ({ request }) => {
  // Auth check
  const session = parseSession(request.headers.get('cookie'));
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const groqKey = import.meta.env.GROQ_API_KEY;
  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'AI engine not configured — contact administrator' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { symbol, assetClass } = await request.json() as { symbol: string; assetClass: AssetClass };

    if (!symbol || !assetClass) {
      return new Response(JSON.stringify({ error: 'symbol and assetClass required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch market data sequentially to avoid CoinGecko rate limit
    const ticker = await fetchTicker(symbol, assetClass);
    const candles = await fetchOHLC(symbol, assetClass, 30);

    // Compute indicators
    const closes = candles.map(c => c.close);
    const rsi = computeRSI(closes);
    const macd = computeMACD(closes);
    const bb = computeBollinger(closes);
    const ema20 = computeEMA(closes, 20);
    const trend = ticker.price > ema20[ema20.length - 1] ? 'uptrend' : 'downtrend';

    const prompt = `You are a professional ${ticker.assetClass} trader. Analyze and generate a signal.
Asset: ${ticker.symbol} (${ticker.assetClass.toUpperCase()})
Price: ${formatPrice(ticker.price)} | 24h: ${ticker.changePct24h.toFixed(3)}%
RSI(14): ${rsi.toFixed(1)} | MACD hist: ${macd.hist.toFixed(6)} | Trend: ${trend}
BB: upper=${formatPrice(bb.upper)} mid=${formatPrice(bb.middle)} lower=${formatPrice(bb.lower)}
Last 5 closes: ${closes.slice(-5).map(c => formatPrice(c)).join(', ')}
Respond ONLY valid JSON (no markdown):
{"type":"BUY"|"SELL"|"HOLD","confidence":<0-100>,"entry":<num>,"sl":<num>,"tp":<num>,"technicalScore":<0-100>,"fundamentalScore":<0-100>,"riskScore":<0-100>,"reason":"<2-3 sentences>"}`;

    // Call AI engine (server-side, key never exposed to client)
    // Retry on rate limit (429) with exponential backoff
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 512,
          temperature: 0.3,
          messages: [
            { role: 'system', content: 'You are a professional trading analyst. Always respond with valid JSON only, no markdown formatting.' },
            { role: 'user', content: prompt },
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
        return new Response(JSON.stringify({ error: 'AI engine is busy — please wait a moment and try again' }), {
          status: 429, headers: { 'Content-Type': 'application/json' },
        });
      }
      const e = res ? await res.json().catch(() => ({})) : {};
      throw new Error((e as any).error?.message ?? 'Signal generation failed');
    }

    const data = await res.json();
    const text = data.choices[0].message.content;
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    const rr = Math.abs(parsed.tp - parsed.entry) / Math.abs(parsed.entry - parsed.sl);

    const signal = {
      id: `${ticker.symbol}-${Date.now()}`,
      symbol: ticker.symbol,
      assetClass: ticker.assetClass,
      ...parsed,
      rr: parseFloat(rr.toFixed(2)),
      timestamp: Date.now(),
    };

    return new Response(JSON.stringify(signal), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signal generation failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
