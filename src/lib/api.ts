// ─── FREE APIS ────────────────────────────────────────────────────────────────
// CoinGecko    → crypto prices & OHLC  (no key, public)
// Frankfurter  → forex rates (ECB)     (no key, unlimited)
// Yahoo Finance→ stocks via query2     (no key, unofficial)
// Groq         → AI signal generation  (free API key, Llama 3.3 70B)
// ──────────────────────────────────────────────────────────────────────────────

export type AssetClass = 'crypto' | 'forex' | 'stock';

export interface CandleData {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
}

export interface Ticker {
  symbol: string; name?: string; assetClass: AssetClass;
  price: number; change24h: number; changePct24h: number;
  high24h: number; low24h: number; volume24h: number;
  marketCap?: number; currency?: string;
}

export interface Signal {
  id: string; symbol: string; assetClass: AssetClass;
  type: 'BUY' | 'SELL' | 'HOLD'; confidence: number;
  entry: number; sl: number; tp: number; rr: number;
  technicalScore: number; fundamentalScore: number; riskScore: number;
  reason: string; timestamp: number;
}

// ─── CACHE — prevents CoinGecko rate limiting ───────────────────────────────
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_TICKER = 60_000;   // 60s for prices (reduces API calls)
const CACHE_TTL_OHLC   = 300_000;  // 5min for OHLC (changes slowly)

function cacheGet<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T;
  return null;
}
function cacheSet(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

// ─── FETCH WITH RETRY — handles 429 rate limit ─────────────────────────────
async function fetchRetry(url: string, opts?: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, opts);
    if (res.ok) return res;
    if (res.status === 429 && i < retries - 1) {
      // Rate limited — wait and retry
      const wait = (i + 1) * 2000; // 2s, 4s, 6s
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return res; // Return non-429 errors as-is
  }
  return fetch(url, opts); // Final attempt
}

// ─── CRYPTO ───────────────────────────────────────────────────────────────────
const COIN_IDS: Record<string, string> = {
  BTC:'bitcoin',ETH:'ethereum',BNB:'binancecoin',SOL:'solana',ADA:'cardano',
  DOGE:'dogecoin',XRP:'ripple',AVAX:'avalanche-2',DOT:'polkadot',
  LINK:'chainlink',MATIC:'matic-network',UNI:'uniswap',
};

async function fetchBinanceTicker(symbol: string): Promise<Ticker> {
  const pair = BINANCE_SYMBOLS[symbol];
  if (!pair) throw new Error(`No mapping for ${symbol}`);
  const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`);
  if (!r.ok) throw new Error(`Ticker error (${r.status})`);
  const d = await r.json();
  const price = parseFloat(d.lastPrice);
  return {
    symbol, assetClass: 'crypto', price,
    change24h: parseFloat(d.priceChange),
    changePct24h: parseFloat(d.priceChangePercent),
    high24h: parseFloat(d.highPrice),
    low24h: parseFloat(d.lowPrice),
    volume24h: parseFloat(d.quoteVolume),
    currency: 'USD',
  };
}

async function fetchCoinGeckoTicker(symbol: string): Promise<Ticker> {
  const id = COIN_IDS[symbol] ?? symbol.toLowerCase();
  const r = await fetchRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true&include_market_cap=true`);
  if (!r.ok) throw new Error(`Ticker error (${r.status})`);
  const d = (await r.json())[id];
  if (!d) throw new Error(`No data for ${symbol}`);
  return { symbol, assetClass:'crypto', price:d.usd,
    change24h:(d.usd*(d.usd_24h_change??0))/100, changePct24h:d.usd_24h_change??0,
    high24h:d.usd_24h_high??d.usd, low24h:d.usd_24h_low??d.usd,
    volume24h:d.usd_24h_vol??0, marketCap:d.usd_market_cap, currency:'USD' };
}

export async function fetchCryptoTicker(symbol: string): Promise<Ticker> {
  const cacheKey = `ticker:${symbol}`;
  const cached = cacheGet<Ticker>(cacheKey, CACHE_TTL_TICKER);
  if (cached) return cached;

  let ticker: Ticker;
  try {
    ticker = await fetchBinanceTicker(symbol);
  } catch {
    ticker = await fetchCoinGeckoTicker(symbol);
  }
  cacheSet(cacheKey, ticker);
  return ticker;
}

// Binance symbol mapping (no API key needed for public klines)
const BINANCE_SYMBOLS: Record<string, string> = {
  BTC:'BTCUSDT',ETH:'ETHUSDT',BNB:'BNBUSDT',SOL:'SOLUSDT',ADA:'ADAUSDT',
  DOGE:'DOGEUSDT',XRP:'XRPUSDT',AVAX:'AVAXUSDT',DOT:'DOTUSDT',
  LINK:'LINKUSDT',MATIC:'MATICUSDT',UNI:'UNIUSDT',
};

async function fetchBinanceOHLC(symbol: string, days: number): Promise<CandleData[]> {
  const pair = BINANCE_SYMBOLS[symbol];
  if (!pair) throw new Error(`No Binance mapping for ${symbol}`);
  // Pick interval: <=7d → 1h, <=90d → 4h, >90d → 1d
  const interval = days <= 7 ? '1h' : days <= 90 ? '4h' : '1d';
  const limit = Math.min(days <= 7 ? days * 24 : days <= 90 ? days * 6 : days, 1000);
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance error (${r.status})`);
  const raw: any[] = await r.json();
  return raw.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]), high: parseFloat(k[2]),
    low: parseFloat(k[3]), close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchCoinGeckoOHLC(symbol: string, days: number): Promise<CandleData[]> {
  const id = COIN_IDS[symbol] ?? symbol.toLowerCase();
  const r = await fetchRetry(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
  if (!r.ok) throw new Error(`OHLC data temporarily unavailable`);
  const raw: [number,number,number,number,number][] = await r.json();
  if (!Array.isArray(raw)) throw new Error('OHLC data: unexpected response format');
  return raw.map(([ts,o,h,l,c])=>({time:Math.floor(ts/1000),open:o,high:h,low:l,close:c}));
}

export async function fetchCryptoOHLC(symbol: string, days=14): Promise<CandleData[]> {
  const cacheKey = `ohlc:${symbol}:${days}`;
  const cached = cacheGet<CandleData[]>(cacheKey, CACHE_TTL_OHLC);
  if (cached) return cached;

  let candles: CandleData[];
  try {
    // Primary: Binance (reliable, no rate limits)
    candles = await fetchBinanceOHLC(symbol, days);
  } catch {
    // Fallback: CoinGecko
    candles = await fetchCoinGeckoOHLC(symbol, days);
  }
  cacheSet(cacheKey, candles);
  return candles;
}

export async function fetchMultipleCryptoTickers(symbols: string[]): Promise<Ticker[]> {
  const cacheKey = `multi:${symbols.join(',')}`;
  const cached = cacheGet<Ticker[]>(cacheKey, CACHE_TTL_TICKER);
  if (cached) return cached;

  let tickers: Ticker[];
  try {
    // Primary: Binance batch ticker (single request, no rate limits)
    const pairs = symbols.map(s => BINANCE_SYMBOLS[s]).filter(Boolean);
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(pairs))}`);
    if (!r.ok) throw new Error(`Ticker error (${r.status})`);
    const data: any[] = await r.json();
    const byPair = new Map(data.map(d => [d.symbol, d]));
    tickers = symbols.map(sym => {
      const pair = BINANCE_SYMBOLS[sym];
      const d = pair ? byPair.get(pair) : null;
      if (!d) return { symbol: sym, assetClass: 'crypto' as AssetClass, price: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0 };
      return {
        symbol: sym, assetClass: 'crypto' as AssetClass,
        price: parseFloat(d.lastPrice), change24h: parseFloat(d.priceChange),
        changePct24h: parseFloat(d.priceChangePercent),
        high24h: parseFloat(d.highPrice), low24h: parseFloat(d.lowPrice),
        volume24h: parseFloat(d.quoteVolume), currency: 'USD',
      };
    });
  } catch {
    // Fallback: CoinGecko
    const ids = symbols.map(s => COIN_IDS[s] ?? s.toLowerCase()).join(',');
    const r = await fetchRetry(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_high_24hr=true&include_low_24hr=true&include_market_cap=true`);
    if (!r.ok) throw new Error('Market data temporarily unavailable — please try again');
    const data = await r.json();
    tickers = symbols.map(sym => {
      const id = COIN_IDS[sym] ?? sym.toLowerCase(); const d = data[id];
      if (!d) return { symbol: sym, assetClass: 'crypto' as AssetClass, price: 0, change24h: 0, changePct24h: 0, high24h: 0, low24h: 0, volume24h: 0 };
      return { symbol: sym, assetClass: 'crypto' as AssetClass, price: d.usd,
        change24h: (d.usd * (d.usd_24h_change ?? 0)) / 100, changePct24h: d.usd_24h_change ?? 0,
        high24h: d.usd_24h_high ?? d.usd, low24h: d.usd_24h_low ?? d.usd,
        volume24h: d.usd_24h_vol ?? 0, marketCap: d.usd_market_cap, currency: 'USD' };
    });
  }
  cacheSet(cacheKey, tickers);
  return tickers;
}

// ─── FOREX (Frankfurter — ECB, truly free) ────────────────────────────────────
export async function fetchForexTicker(pair: string): Promise<Ticker> {
  const cacheKey = `fx:${pair}`;
  const cached = cacheGet<Ticker>(cacheKey, CACHE_TTL_TICKER);
  if (cached) return cached;

  const [base,quote]=pair.split('/');
  const r = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${quote}`);
  if (!r.ok) throw new Error('Forex data temporarily unavailable');
  const data = await r.json(); const price=data.rates[quote];
  const ticker: Ticker = {symbol:pair,assetClass:'forex',name:`${base}/${quote}`,price,
    change24h:0,changePct24h:0,high24h:price*1.005,low24h:price*0.995,volume24h:0,currency:quote};
  cacheSet(cacheKey, ticker);
  return ticker;
}

export async function fetchForexOHLC(pair: string, days=14): Promise<CandleData[]> {
  const cacheKey = `fxohlc:${pair}:${days}`;
  const cached = cacheGet<CandleData[]>(cacheKey, CACHE_TTL_OHLC);
  if (cached) return cached;

  const [base,quote]=pair.split('/');
  const end=new Date(); const start=new Date(end); start.setDate(start.getDate()-days);
  const fmt=(d:Date)=>d.toISOString().split('T')[0];
  const r = await fetch(`https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${base}&to=${quote}`);
  if (!r.ok) throw new Error('Forex data temporarily unavailable');
  const data = await r.json();
  const entries=Object.entries(data.rates) as [string,Record<string,number>][];
  const candles = entries.map(([dateStr,rates],i)=>{
    const price=rates[quote];
    const prev=i>0?(Object.values(entries[i-1][1])[0]):price;
    return {time:Math.floor(new Date(dateStr).getTime()/1000),open:prev,high:price*1.002,low:price*0.998,close:price};
  });
  cacheSet(cacheKey, candles);
  return candles;
}

// ─── STOCKS (Yahoo Finance query2 — no key needed) ────────────────────────────
export async function fetchStockTicker(symbol: string): Promise<Ticker> {
  const cacheKey = `stock:${symbol}`;
  const cached = cacheGet<Ticker>(cacheKey, CACHE_TTL_TICKER);
  if (cached) return cached;

  const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
    {headers:{'User-Agent':'Mozilla/5.0'}});
  if (!r.ok) throw new Error('Stock data temporarily unavailable');
  const data=await r.json(); const meta=data.chart.result[0].meta;
  const ticker: Ticker = {symbol,assetClass:'stock',name:meta.shortName??symbol,price:meta.regularMarketPrice,
    change24h:meta.regularMarketPrice-meta.previousClose,
    changePct24h:((meta.regularMarketPrice-meta.previousClose)/meta.previousClose)*100,
    high24h:meta.regularMarketDayHigh??meta.regularMarketPrice,
    low24h:meta.regularMarketDayLow??meta.regularMarketPrice,
    volume24h:meta.regularMarketVolume??0,currency:meta.currency};
  cacheSet(cacheKey, ticker);
  return ticker;
}

export async function fetchStockOHLC(symbol: string, days=14): Promise<CandleData[]> {
  const cacheKey = `stockohlc:${symbol}:${days}`;
  const cached = cacheGet<CandleData[]>(cacheKey, CACHE_TTL_OHLC);
  if (cached) return cached;

  const r = await fetch(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`,
    {headers:{'User-Agent':'Mozilla/5.0'}});
  if (!r.ok) throw new Error('Stock data temporarily unavailable');
  const data=await r.json(); const result=data.chart.result[0];
  const ts:number[]=result.timestamp; const q=result.indicators.quote[0];
  const candles = ts.map((t,i)=>({time:t,open:q.open[i]??0,high:q.high[i]??0,low:q.low[i]??0,close:q.close[i]??0,volume:q.volume[i]??0}))
    .filter(c=>c.close>0);
  cacheSet(cacheKey, candles);
  return candles;
}

// ─── UNIFIED ──────────────────────────────────────────────────────────────────
// Retry wrapper — retries up to 2 times with 1.5s delay on failure
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw new Error('Data temporarily unavailable');
}

export async function fetchTicker(symbol:string, ac:AssetClass): Promise<Ticker> {
  return withRetry(() => {
    if (ac==='crypto') return fetchCryptoTicker(symbol);
    if (ac==='forex')  return fetchForexTicker(symbol);
    return fetchStockTicker(symbol);
  });
}
export async function fetchOHLC(symbol:string, ac:AssetClass, days=14): Promise<CandleData[]> {
  return withRetry(() => {
    if (ac==='crypto') return fetchCryptoOHLC(symbol,days);
    if (ac==='forex')  return fetchForexOHLC(symbol,days);
    return fetchStockOHLC(symbol,days);
  });
}

// ─── INDICATORS ───────────────────────────────────────────────────────────────
export function computeRSI(closes:number[], period=14): number {
  if (closes.length<period+1) return 50;
  let g=0,l=0;
  for (let i=closes.length-period;i<closes.length;i++){
    const d=closes[i]-closes[i-1]; if(d>0)g+=d; else l-=d;
  }
  return 100-100/(1+(g/(l||0.0001)));
}
export function computeEMA(vals:number[], period:number): number[] {
  const k=2/(period+1); const ema=[vals[0]];
  for (let i=1;i<vals.length;i++) ema.push(vals[i]*k+ema[i-1]*(1-k));
  return ema;
}
export function computeMACD(closes:number[]) {
  if (closes.length<26) return {macd:0,signal:0,hist:0};
  const e12=computeEMA(closes,12); const e26=computeEMA(closes,26);
  const ml=e12.map((v,i)=>v-e26[i]); const sl=computeEMA(ml,9); const n=ml.length-1;
  return {macd:ml[n],signal:sl[n],hist:ml[n]-sl[n]};
}
export function computeBollinger(closes:number[], period=20) {
  if (closes.length<period) return {upper:0,middle:0,lower:0};
  const s=closes.slice(-period); const mean=s.reduce((a,b)=>a+b,0)/period;
  const std=Math.sqrt(s.reduce((sum,v)=>sum+(v-mean)**2,0)/period);
  return {upper:mean+2*std,middle:mean,lower:mean-2*std};
}

// ─── AI SIGNAL (Groq — free, OpenAI-compatible) ─────────────────────────────
export async function generateSignal(ticker:Ticker, candles:CandleData[], apiKey:string): Promise<Signal> {
  const closes=candles.map(c=>c.close);
  const rsi=computeRSI(closes); const macd=computeMACD(closes);
  const bb=computeBollinger(closes); const ema20=computeEMA(closes,20);
  const trend=ticker.price>ema20[ema20.length-1]?'uptrend':'downtrend';
  const prompt=`You are a professional ${ticker.assetClass} trader. Analyze and generate a signal.
Asset: ${ticker.symbol} (${ticker.assetClass.toUpperCase()})
Price: ${formatPrice(ticker.price)} | 24h: ${ticker.changePct24h.toFixed(3)}%
RSI(14): ${rsi.toFixed(1)} | MACD hist: ${macd.hist.toFixed(6)} | Trend: ${trend}
BB: upper=${formatPrice(bb.upper)} mid=${formatPrice(bb.middle)} lower=${formatPrice(bb.lower)}
Last 5 closes: ${closes.slice(-5).map(c=>formatPrice(c)).join(', ')}
Respond ONLY valid JSON (no markdown):
{"type":"BUY"|"SELL"|"HOLD","confidence":<0-100>,"entry":<num>,"sl":<num>,"tp":<num>,"technicalScore":<0-100>,"fundamentalScore":<0-100>,"riskScore":<0-100>,"reason":"<2-3 sentences>"}`;
  const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify({
      model:'llama-3.3-70b-versatile',
      max_tokens:512,
      temperature:0.3,
      messages:[
        {role:'system',content:'You are a professional trading analyst. Always respond with valid JSON only, no markdown formatting.'},
        {role:'user',content:prompt},
      ],
    }),
  });
  if (!res.ok){const e=await res.json();throw new Error(e.error?.message??'AI signal generation failed');}
  const data=await res.json();
  const text=data.choices[0].message.content;
  const parsed=JSON.parse(text.replace(/```json|```/g,'').trim());
  const rr=Math.abs(parsed.tp-parsed.entry)/Math.abs(parsed.entry-parsed.sl);
  return {id:`${ticker.symbol}-${Date.now()}`,symbol:ticker.symbol,assetClass:ticker.assetClass,
    ...parsed,rr:parseFloat(rr.toFixed(2)),timestamp:Date.now()};
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export function formatPrice(n:number): string {
  if (!n||n===0) return '0';
  if (n>=10000)  return n.toLocaleString('en-US',{maximumFractionDigits:0});
  if (n>=100)    return n.toFixed(2);
  if (n>=1)      return n.toFixed(4);
  return n.toFixed(6);
}
export function formatVolume(n:number): string {
  if (n>=1e9) return `$${(n/1e9).toFixed(1)}B`;
  if (n>=1e6) return `$${(n/1e6).toFixed(1)}M`;
  if (n>=1e3) return `$${(n/1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export const CRYPTO_SYMBOLS = ['BTC','ETH','SOL','BNB','ADA','XRP','DOGE','AVAX','DOT','LINK'];
export const FOREX_PAIRS    = ['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD'];
export const STOCK_SYMBOLS  = ['AAPL','MSFT','NVDA','TSLA','AMZN','META','GOOGL','SPY'];
