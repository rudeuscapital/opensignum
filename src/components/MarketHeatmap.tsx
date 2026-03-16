import { useState, useEffect } from 'react';
import { Grid3x3, RefreshCw } from 'lucide-react';
import { fetchMultipleCryptoTickers, formatPrice, CRYPTO_SYMBOLS } from '../lib/api';
import type { Ticker } from '../lib/api';

export default function MarketHeatmap() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<'change' | 'volume'>('change');

  const refresh = async () => {
    setLoading(true);
    try {
      const t = await fetchMultipleCryptoTickers(CRYPTO_SYMBOLS);
      setTickers(t);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const sorted = [...tickers].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  const maxMcap = Math.max(...sorted.map(t => t.marketCap ?? 0), 1);

  const getColor = (pct: number) => {
    if (pct >= 5) return '#00d4aa';
    if (pct >= 2) return '#00a882';
    if (pct >= 0) return '#1a6b5a';
    if (pct >= -2) return '#6b3a3a';
    if (pct >= -5) return '#cc2e4a';
    return '#ff4d6a';
  };

  const getBg = (pct: number) => {
    if (pct >= 5) return 'rgba(0,212,170,0.25)';
    if (pct >= 2) return 'rgba(0,212,170,0.15)';
    if (pct >= 0) return 'rgba(0,212,170,0.06)';
    if (pct >= -2) return 'rgba(255,77,106,0.06)';
    if (pct >= -5) return 'rgba(255,77,106,0.15)';
    return 'rgba(255,77,106,0.25)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Grid3x3 size={15} color="var(--green)" /> Market Heatmap
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Crypto market overview — size by market cap, color by 24h change</p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
          cursor: loading ? 'wait' : 'pointer', fontSize: 11,
        }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Refresh
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 10, color: 'var(--text3)' }}>
        <span>24h Change:</span>
        {[
          { label: '<-5%', color: '#ff4d6a' },
          { label: '-2%', color: '#cc2e4a' },
          { label: '0%', color: 'var(--text3)' },
          { label: '+2%', color: '#00a882' },
          { label: '>+5%', color: '#00d4aa' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Heatmap grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, minHeight: 300 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg3)', borderRadius: 8, animation: 'pulse 1.5s infinite', minHeight: 80 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
          {sorted.map((t, i) => {
            const pct = t.changePct24h;
            const sizeWeight = Math.max(0.6, Math.min(1, (t.marketCap ?? 0) / maxMcap * 5 + 0.6));
            return (
              <div key={t.symbol} style={{
                background: getBg(pct),
                border: `1px solid ${getColor(pct)}33`,
                borderRadius: 8,
                padding: `${Math.round(14 * sizeWeight)}px 12px`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'default', transition: 'transform .15s',
                minHeight: i < 5 ? 100 : 80,
              }}
                onMouseEnter={e => (e.currentTarget).style.transform = 'scale(1.03)'}
                onMouseLeave={e => (e.currentTarget).style.transform = 'none'}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: i < 3 ? 16 : 13, fontWeight: 700, color: 'var(--text)' }}>
                  {t.symbol}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: i < 3 ? 14 : 12, marginTop: 4 }}>
                  ${formatPrice(t.price)}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: i < 3 ? 13 : 11, fontWeight: 700,
                  marginTop: 4, color: getColor(pct),
                }}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </span>
                {t.marketCap && i < 5 && (
                  <span style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                    MCap: {(t.marketCap / 1e9).toFixed(0)}B
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
