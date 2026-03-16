import { useState, useEffect } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import { fetchCryptoOHLC, CRYPTO_SYMBOLS } from '../lib/api';

function computeCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const ax = a.slice(-n), bx = b.slice(-n);
  const meanA = ax.reduce((s, v) => s + v, 0) / n;
  const meanB = bx.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = ax[i] - meanA, db = bx[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

const SYMBOLS = CRYPTO_SYMBOLS.slice(0, 8);

export default function CorrelationMatrix() {
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);

  const compute = async () => {
    setLoading(true);
    try {
      const closesMap: Record<string, number[]> = {};
      for (const sym of SYMBOLS) {
        try {
          const candles = await fetchCryptoOHLC(sym, 30);
          closesMap[sym] = candles.map(c => c.close);
        } catch { closesMap[sym] = []; }
      }
      // Returns pct changes for better correlation
      const pctChanges = (vals: number[]) => vals.slice(1).map((v, i) => (v - vals[i]) / vals[i]);

      const m: number[][] = [];
      for (let i = 0; i < SYMBOLS.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < SYMBOLS.length; j++) {
          if (i === j) { row.push(1); continue; }
          const a = pctChanges(closesMap[SYMBOLS[i]] || []);
          const b = pctChanges(closesMap[SYMBOLS[j]] || []);
          row.push(computeCorrelation(a, b));
        }
        m.push(row);
      }
      setMatrix(m);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { compute(); }, []);

  const getColor = (v: number) => {
    if (v >= 0.7) return 'rgba(0,212,170,0.6)';
    if (v >= 0.4) return 'rgba(0,212,170,0.3)';
    if (v >= 0.1) return 'rgba(0,212,170,0.1)';
    if (v >= -0.1) return 'var(--bg3)';
    if (v >= -0.4) return 'rgba(255,77,106,0.1)';
    if (v >= -0.7) return 'rgba(255,77,106,0.3)';
    return 'rgba(255,77,106,0.6)';
  };

  const getTextColor = (v: number) => {
    if (Math.abs(v) >= 0.4) return 'var(--text)';
    return 'var(--text3)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <GitBranch size={15} color="var(--purple)" /> Correlation Matrix
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>30-day price correlation between crypto assets (Pearson)</p>
        </div>
        <button onClick={compute} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
          cursor: loading ? 'wait' : 'pointer', fontSize: 11,
        }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Recalculate
        </button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10 }}>
        <span style={{ color: 'var(--text3)' }}>Correlation:</span>
        {[
          { label: '-1.0', bg: 'rgba(255,77,106,0.6)' },
          { label: '0', bg: 'var(--bg3)' },
          { label: '+1.0', bg: 'rgba(0,212,170,0.6)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 14, height: 14, borderRadius: 2, background: l.bg }} />
            <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{l.label}</span>
          </div>
        ))}
        <span style={{ color: 'var(--text3)', marginLeft: 8 }}>High correlation = assets move together. Negative = inverse.</span>
      </div>

      {/* Matrix */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${SYMBOLS.length}, 1fr)`, gap: 2 }}>
          {Array.from({ length: (SYMBOLS.length + 1) * (SYMBOLS.length + 1) }).map((_, i) => (
            <div key={i} style={{ height: 36, background: 'var(--bg3)', borderRadius: 3, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `50px repeat(${SYMBOLS.length}, 1fr)`, gap: 2 }}>
            {/* Header row */}
            <div />
            {SYMBOLS.map(s => (
              <div key={s} style={{
                padding: '6px 4px', textAlign: 'center', fontFamily: 'var(--font-mono)',
                fontSize: 10, fontWeight: 700, color: 'var(--text2)',
              }}>{s}</div>
            ))}
            {/* Data rows */}
            {SYMBOLS.map((rowSym, i) => (
              <>
                <div key={`label-${rowSym}`} style={{
                  padding: '6px 4px', fontFamily: 'var(--font-mono)', fontSize: 10,
                  fontWeight: 700, color: 'var(--text2)', display: 'flex', alignItems: 'center',
                }}>{rowSym}</div>
                {SYMBOLS.map((_, j) => {
                  const v = matrix[i]?.[j] ?? 0;
                  return (
                    <div key={`${i}-${j}`} style={{
                      padding: '8px 4px', textAlign: 'center', borderRadius: 4,
                      background: getColor(v), fontFamily: 'var(--font-mono)',
                      fontSize: 11, fontWeight: i === j ? 700 : 500,
                      color: getTextColor(v),
                    }}
                      title={`${SYMBOLS[i]} vs ${SYMBOLS[j]}: ${v.toFixed(3)}`}
                    >
                      {v.toFixed(2)}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
