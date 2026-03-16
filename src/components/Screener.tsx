import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, TrendingUp, TrendingDown, Minus, RefreshCw, ArrowUpDown } from 'lucide-react';
import { fetchMultipleCryptoTickers, fetchCryptoOHLC, computeRSI, computeMACD, computeBollinger, computeEMA, formatPrice, formatVolume, CRYPTO_SYMBOLS } from '../lib/api';
import type { Ticker } from '../lib/api';

interface ScreenerRow {
  ticker: Ticker;
  rsi: number;
  macdHist: number;
  bbPosition: 'above' | 'middle' | 'below';
  ema20Trend: 'above' | 'below';
  volume24h: number;
  loading: boolean;
}

type SortKey = 'symbol' | 'price' | 'change' | 'rsi' | 'macd' | 'volume';
type SortDir = 'asc' | 'desc';

interface FilterConfig {
  rsiBelow: number | null;
  rsiAbove: number | null;
  macdBullish: boolean;
  macdBearish: boolean;
  aboveEma: boolean;
  belowBb: boolean;
  minChange: number | null;
  maxChange: number | null;
}

const DEFAULT_FILTER: FilterConfig = {
  rsiBelow: null, rsiAbove: null,
  macdBullish: false, macdBearish: false,
  aboveEma: false, belowBb: false,
  minChange: null, maxChange: null,
};

const PRESETS: { name: string; desc: string; filter: Partial<FilterConfig> }[] = [
  { name: 'Oversold', desc: 'RSI < 30', filter: { rsiBelow: 30 } },
  { name: 'Overbought', desc: 'RSI > 70', filter: { rsiAbove: 70 } },
  { name: 'Bullish MACD', desc: 'Positive histogram', filter: { macdBullish: true } },
  { name: 'Uptrend', desc: 'Price > EMA20', filter: { aboveEma: true } },
  { name: 'BB Dip', desc: 'Below lower Bollinger', filter: { belowBb: true } },
  { name: 'Big Movers', desc: '> 5% change', filter: { minChange: 5 } },
];

export default function Screener() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterConfig>(DEFAULT_FILTER);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const tickers = await fetchMultipleCryptoTickers(CRYPTO_SYMBOLS);
      const initial: ScreenerRow[] = tickers.map(t => ({
        ticker: t, rsi: 50, macdHist: 0, bbPosition: 'middle' as const,
        ema20Trend: 'above' as const, volume24h: t.volume24h, loading: true,
      }));
      setRows(initial);

      // Fetch indicators sequentially to avoid rate limits
      const updated = [...initial];
      for (let i = 0; i < tickers.length; i++) {
        try {
          const candles = await fetchCryptoOHLC(tickers[i].symbol, 30);
          const closes = candles.map(c => c.close);
          if (closes.length >= 20) {
            const rsi = computeRSI(closes);
            const macd = computeMACD(closes);
            const bb = computeBollinger(closes);
            const ema = computeEMA(closes, 20);
            const price = tickers[i].price;
            updated[i] = {
              ...updated[i],
              rsi, macdHist: macd.hist,
              bbPosition: price > bb.upper ? 'above' : price < bb.lower ? 'below' : 'middle',
              ema20Trend: price > ema[ema.length - 1] ? 'above' : 'below',
              loading: false,
            };
            setRows([...updated]);
          }
        } catch { updated[i] = { ...updated[i], loading: false }; }
      }
      setRows([...updated]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { scan(); }, [scan]);

  const filtered = rows.filter(r => {
    if (filter.rsiBelow !== null && r.rsi >= filter.rsiBelow) return false;
    if (filter.rsiAbove !== null && r.rsi <= filter.rsiAbove) return false;
    if (filter.macdBullish && r.macdHist <= 0) return false;
    if (filter.macdBearish && r.macdHist >= 0) return false;
    if (filter.aboveEma && r.ema20Trend !== 'above') return false;
    if (filter.belowBb && r.bbPosition !== 'below') return false;
    if (filter.minChange !== null && Math.abs(r.ticker.changePct24h) < filter.minChange) return false;
    if (filter.maxChange !== null && Math.abs(r.ticker.changePct24h) > filter.maxChange) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va = 0, vb = 0;
    switch (sortKey) {
      case 'symbol': return sortDir === 'asc' ? a.ticker.symbol.localeCompare(b.ticker.symbol) : b.ticker.symbol.localeCompare(a.ticker.symbol);
      case 'price': va = a.ticker.price; vb = b.ticker.price; break;
      case 'change': va = a.ticker.changePct24h; vb = b.ticker.changePct24h; break;
      case 'rsi': va = a.rsi; vb = b.rsi; break;
      case 'macd': va = a.macdHist; vb = b.macdHist; break;
      case 'volume': va = a.volume24h; vb = b.volume24h; break;
    }
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const applyPreset = (preset: Partial<FilterConfig>) => {
    setFilter({ ...DEFAULT_FILTER, ...preset });
    setShowFilters(true);
  };

  const activeFilters = Object.values(filter).filter(v => v !== null && v !== false).length;

  const rsiColor = (v: number) => v < 30 ? 'var(--green)' : v > 70 ? 'var(--red)' : 'var(--text2)';
  const rsiLabel = (v: number) => v < 30 ? 'Oversold' : v > 70 ? 'Overbought' : 'Neutral';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Search size={15} color="var(--blue)" /> Market Screener
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>
            Scan assets by technical conditions · {sorted.length}/{rows.length} match
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowFilters(f => !f)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
            border: `1px solid ${activeFilters > 0 ? 'var(--blue)' : 'var(--border)'}`,
            background: activeFilters > 0 ? 'rgba(59,158,255,.08)' : 'transparent',
            color: activeFilters > 0 ? 'var(--blue)' : 'var(--text2)', cursor: 'pointer', fontSize: 11,
          }}>
            <Filter size={12} /> Filters {activeFilters > 0 && `(${activeFilters})`}
          </button>
          <button onClick={scan} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
            cursor: loading ? 'wait' : 'pointer', fontSize: 11,
          }}>
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Scan
          </button>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => { setFilter(DEFAULT_FILTER); setShowFilters(false); }} style={{
          padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
          background: activeFilters === 0 ? 'var(--bg4)' : 'transparent',
          color: activeFilters === 0 ? 'var(--text)' : 'var(--text3)', cursor: 'pointer', fontSize: 10,
        }}>All</button>
        {PRESETS.map(p => (
          <button key={p.name} onClick={() => applyPreset(p.filter)} title={p.desc} style={{
            padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 10,
          }}>{p.name}</button>
        ))}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>RSI Below</div>
              <input type="number" placeholder="e.g. 30" value={filter.rsiBelow ?? ''} onChange={e => setFilter(f => ({ ...f, rsiBelow: e.target.value ? Number(e.target.value) : null }))} style={{
                width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>RSI Above</div>
              <input type="number" placeholder="e.g. 70" value={filter.rsiAbove ?? ''} onChange={e => setFilter(f => ({ ...f, rsiAbove: e.target.value ? Number(e.target.value) : null }))} style={{
                width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Min Change %</div>
              <input type="number" placeholder="e.g. 5" value={filter.minChange ?? ''} onChange={e => setFilter(f => ({ ...f, minChange: e.target.value ? Number(e.target.value) : null }))} style={{
                width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--bg3)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)',
              }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Conditions</div>
              {[
                { key: 'macdBullish' as const, label: 'MACD Bullish' },
                { key: 'aboveEma' as const, label: 'Above EMA20' },
                { key: 'belowBb' as const, label: 'Below BB Lower' },
              ].map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={filter[c.key]} onChange={() => setFilter(f => ({ ...f, [c.key]: !f[c.key] }))} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {([
                { key: 'symbol' as SortKey, label: 'Asset', w: '12%' },
                { key: 'price' as SortKey, label: 'Price', w: '14%' },
                { key: 'change' as SortKey, label: '24h Change', w: '14%' },
                { key: 'rsi' as SortKey, label: 'RSI (14)', w: '16%' },
                { key: 'macd' as SortKey, label: 'MACD', w: '14%' },
                { key: 'volume' as SortKey, label: 'Volume', w: '14%' },
              ]).map(col => (
                <th key={col.key} onClick={() => toggleSort(col.key)} style={{
                  textAlign: 'left', padding: '10px 12px', fontSize: 10, color: 'var(--text3)',
                  fontWeight: 500, cursor: 'pointer', width: col.w, userSelect: 'none',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {sortKey === col.key && <ArrowUpDown size={10} color="var(--blue)" />}
                  </span>
                </th>
              ))}
              <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '16%' }}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const up = r.ticker.changePct24h >= 0;
              // Simple signal logic
              let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
              if (r.rsi < 30 && r.macdHist > 0) signal = 'BUY';
              else if (r.rsi > 70 && r.macdHist < 0) signal = 'SELL';
              else if (r.rsi < 40 && r.ema20Trend === 'above') signal = 'BUY';
              else if (r.rsi > 60 && r.ema20Trend === 'below') signal = 'SELL';

              return (
                <tr key={r.ticker.symbol} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {r.ticker.symbol}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                    ${formatPrice(r.ticker.price)}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: up ? 'var(--green)' : 'var(--red)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {up ? '+' : ''}{r.ticker.changePct24h.toFixed(2)}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.loading ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>Loading...</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2, maxWidth: 60 }}>
                          <div style={{ width: `${r.rsi}%`, height: '100%', background: rsiColor(r.rsi), borderRadius: 2 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: rsiColor(r.rsi) }}>
                          {r.rsi.toFixed(0)}
                        </span>
                        <span style={{ fontSize: 9, color: rsiColor(r.rsi) }}>{rsiLabel(r.rsi)}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: r.macdHist > 0 ? 'var(--green)' : r.macdHist < 0 ? 'var(--red)' : 'var(--text3)' }}>
                    {r.loading ? '...' : `${r.macdHist >= 0 ? '+' : ''}${r.macdHist.toFixed(2)}`}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                    ${formatVolume(r.volume24h)}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {r.loading ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>...</span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        background: signal === 'BUY' ? 'rgba(0,212,170,.08)' : signal === 'SELL' ? 'rgba(255,77,106,.08)' : 'var(--bg4)',
                        color: signal === 'BUY' ? 'var(--green)' : signal === 'SELL' ? 'var(--red)' : 'var(--text3)',
                        border: `1px solid ${signal === 'BUY' ? 'rgba(0,212,170,.2)' : signal === 'SELL' ? 'rgba(255,77,106,.2)' : 'var(--border)'}`,
                      }}>
                        {signal === 'BUY' ? <TrendingUp size={10} /> : signal === 'SELL' ? <TrendingDown size={10} /> : <Minus size={10} />}
                        {signal}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && !loading && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>No assets match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
