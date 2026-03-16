import { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Plus, X, RefreshCw } from 'lucide-react';
import { fetchOHLC, CRYPTO_SYMBOLS } from '../lib/api';
import type { CandleData } from '../lib/api';
import { createChart, ColorType } from 'lightweight-charts';

interface ChartSlot {
  id: string;
  symbol: string;
  timeframe: number; // days
}

function MiniChart({ symbol, days }: { symbol: string; days: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = '';
    setLoading(true);
    setError(null);

    let chart: any = null;

    (async () => {
      try {
        const candles = await fetchOHLC(symbol, 'crypto', days);
        if (!el.isConnected) return;

        chart = createChart(el, {
          width: el.clientWidth,
          height: el.clientHeight,
          layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#7a92a8', fontSize: 10 },
          grid: { vertLines: { color: '#1e2a3622' }, horzLines: { color: '#1e2a3622' } },
          timeScale: { timeVisible: true, borderColor: '#1e2a36' },
          rightPriceScale: { borderColor: '#1e2a36' },
          crosshair: { mode: 0 },
        });

        const series = chart.addCandlestickSeries({
          upColor: '#00d4aa', downColor: '#ff4d6a',
          borderUpColor: '#00d4aa', borderDownColor: '#ff4d6a',
          wickUpColor: '#00d4aa', wickDownColor: '#ff4d6a',
        });

        series.setData(candles.map(c => ({
          time: c.time as any,
          open: c.open, high: c.high, low: c.low, close: c.close,
        })));

        chart.timeScale().fitContent();
        setLoading(false);

        const ro = new ResizeObserver(() => {
          if (el.isConnected && chart) {
            chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
          }
        });
        ro.observe(el);
        return () => ro.disconnect();
      } catch (e: any) {
        setError(e.message || 'Failed to load');
        setLoading(false);
      }
    })();

    return () => { if (chart) { try { chart.remove(); } catch {} } };
  }, [symbol, days, retryCount]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)' }}>
          <RefreshCw size={16} color="var(--text3)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', gap: 8 }}>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>Failed to load chart</span>
          <button onClick={() => setRetryCount(c => c + 1)} style={{
            padding: '4px 12px', borderRadius: 5, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--blue)', cursor: 'pointer', fontSize: 10,
          }}>Retry</button>
        </div>
      )}
    </div>
  );
}

export default function MultiChart() {
  const [layout, setLayout] = useState<'2x1' | '2x2' | '3x1'>('2x2');
  const [slots, setSlots] = useState<ChartSlot[]>([
    { id: '1', symbol: 'BTC', timeframe: 30 },
    { id: '2', symbol: 'ETH', timeframe: 30 },
    { id: '3', symbol: 'SOL', timeframe: 7 },
    { id: '4', symbol: 'BNB', timeframe: 7 },
  ]);

  const maxSlots = layout === '2x2' ? 4 : layout === '2x1' ? 2 : 3;
  const gridCols = layout === '2x2' ? 2 : layout === '2x1' ? 2 : 3;
  const gridRows = layout === '2x2' ? 2 : 1;

  const updateSlot = (id: string, key: keyof ChartSlot, value: string | number) => {
    setSlots(s => s.map(sl => sl.id === id ? { ...sl, [key]: value } : sl));
  };

  const removeSlot = (id: string) => setSlots(s => s.filter(sl => sl.id !== id));

  const addSlot = () => {
    if (slots.length >= maxSlots) return;
    const available = CRYPTO_SYMBOLS.filter(s => !slots.find(sl => sl.symbol === s));
    setSlots(s => [...s, { id: Date.now().toString(), symbol: available[0] || 'BTC', timeframe: 30 }]);
  };

  // Trim slots if layout shrinks
  useEffect(() => {
    if (slots.length > maxSlots) setSlots(s => s.slice(0, maxSlots));
  }, [layout, maxSlots, slots.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: 'calc(100vh - 180px)', minHeight: 500 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <LayoutGrid size={15} color="var(--blue)" /> Multi-Chart
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Compare multiple assets side by side</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['2x1', '2x2', '3x1'] as const).map(l => (
            <button key={l} onClick={() => setLayout(l)} style={{
              padding: '5px 10px', borderRadius: 5, border: `1px solid ${layout === l ? 'var(--blue)' : 'var(--border)'}`,
              background: layout === l ? 'rgba(59,158,255,.08)' : 'transparent',
              color: layout === l ? 'var(--blue)' : 'var(--text3)', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)',
            }}>{l}</button>
          ))}
          {slots.length < maxSlots && (
            <button onClick={addSlot} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 5,
              border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 10,
            }}><Plus size={10} /> Add</button>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gap: 8, flex: 1,
      }}>
        {slots.slice(0, maxSlots).map(slot => (
          <div key={slot.id} style={{
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
            display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
          }}>
            {/* Chart header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <select value={slot.symbol} onChange={e => updateSlot(slot.id, 'symbol', e.target.value)} style={{
                  padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer',
                }}>
                  {CRYPTO_SYMBOLS.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={slot.timeframe} onChange={e => updateSlot(slot.id, 'timeframe', Number(e.target.value))} style={{
                  padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text2)', fontSize: 10, cursor: 'pointer',
                }}>
                  <option value={7}>7D</option>
                  <option value={14}>14D</option>
                  <option value={30}>30D</option>
                  <option value={90}>90D</option>
                </select>
              </div>
              <button onClick={() => removeSlot(slot.id)} style={{
                background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 2,
              }}><X size={12} /></button>
            </div>
            {/* Chart body */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <MiniChart symbol={slot.symbol} days={slot.timeframe} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
