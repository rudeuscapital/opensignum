import { useState } from 'react';
import { FlaskConical, Play, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';
import { fetchCryptoOHLC, computeRSI, computeEMA, formatPrice, CRYPTO_SYMBOLS } from '../lib/api';

interface BacktestResult {
  totalTrades: number; wins: number; losses: number; winRate: number;
  totalPnlPct: number; maxDrawdown: number; avgWinPct: number; avgLossPct: number;
  profitFactor: number; trades: { date: string; side: string; entry: number; exit: number; pnlPct: number }[];
}

type Strategy = 'rsi_oversold' | 'ema_cross' | 'dip_buy';

const STRATEGIES: { id: Strategy; name: string; desc: string }[] = [
  { id: 'rsi_oversold', name: 'RSI Oversold Bounce', desc: 'Buy when RSI < 30, sell when RSI > 70' },
  { id: 'ema_cross', name: 'EMA Crossover', desc: 'Buy when price crosses above EMA20, sell when below' },
  { id: 'dip_buy', name: 'Buy the Dip (-5%)', desc: 'Buy after 5% drop from recent high, sell after 5% gain' },
];

function runBacktest(closes: number[], strategy: Strategy): BacktestResult {
  const trades: BacktestResult['trades'] = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryIdx = 0;

  if (strategy === 'rsi_oversold') {
    for (let i = 15; i < closes.length; i++) {
      const rsi = computeRSI(closes.slice(0, i + 1));
      if (!inPosition && rsi < 30) {
        inPosition = true; entryPrice = closes[i]; entryIdx = i;
      } else if (inPosition && rsi > 70) {
        const pnlPct = ((closes[i] - entryPrice) / entryPrice) * 100;
        trades.push({ date: `Day ${entryIdx}→${i}`, side: 'LONG', entry: entryPrice, exit: closes[i], pnlPct });
        inPosition = false;
      }
    }
  } else if (strategy === 'ema_cross') {
    const ema = computeEMA(closes, 20);
    for (let i = 21; i < closes.length; i++) {
      const aboveNow = closes[i] > ema[i];
      const abovePrev = closes[i - 1] > ema[i - 1];
      if (!inPosition && aboveNow && !abovePrev) {
        inPosition = true; entryPrice = closes[i]; entryIdx = i;
      } else if (inPosition && !aboveNow && abovePrev) {
        const pnlPct = ((closes[i] - entryPrice) / entryPrice) * 100;
        trades.push({ date: `Day ${entryIdx}→${i}`, side: 'LONG', entry: entryPrice, exit: closes[i], pnlPct });
        inPosition = false;
      }
    }
  } else if (strategy === 'dip_buy') {
    let recentHigh = closes[0];
    for (let i = 1; i < closes.length; i++) {
      recentHigh = Math.max(recentHigh, closes[i]);
      const drawdown = ((recentHigh - closes[i]) / recentHigh) * 100;
      if (!inPosition && drawdown >= 5) {
        inPosition = true; entryPrice = closes[i]; entryIdx = i;
      } else if (inPosition) {
        const gain = ((closes[i] - entryPrice) / entryPrice) * 100;
        if (gain >= 5 || gain <= -10) {
          trades.push({ date: `Day ${entryIdx}→${i}`, side: 'LONG', entry: entryPrice, exit: closes[i], pnlPct: gain });
          inPosition = false; recentHigh = closes[i];
        }
      }
    }
  }

  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const totalPnlPct = trades.reduce((s, t) => s + t.pnlPct, 0);
  const avgWinPct = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;

  // Max drawdown
  let peak = 100, maxDd = 0, equity = 100;
  trades.forEach(t => { equity *= (1 + t.pnlPct / 100); peak = Math.max(peak, equity); maxDd = Math.min(maxDd, ((equity - peak) / peak) * 100); });

  return {
    totalTrades: trades.length, wins: wins.length, losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPnlPct, maxDrawdown: maxDd, avgWinPct, avgLossPct,
    profitFactor: avgLossPct !== 0 ? Math.abs(avgWinPct / avgLossPct) : 0,
    trades,
  };
}

export default function Backtesting() {
  const [symbol, setSymbol] = useState('BTC');
  const [strategy, setStrategy] = useState<Strategy>('rsi_oversold');
  const [days, setDays] = useState(90);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const candles = await fetchCryptoOHLC(symbol, days);
      if (candles.length < 30) throw new Error('Not enough data — try a longer period');
      const closes = candles.map(c => c.close);
      const r = runBacktest(closes, strategy);
      setResult(r);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const selectedStrat = STRATEGIES.find(s => s.id === strategy)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <FlaskConical size={15} color="var(--blue)" /> Backtesting
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Test trading strategies on historical data</p>
      </div>

      {/* Config */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)',
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
          }}>
            {CRYPTO_SYMBOLS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={days} onChange={e => setDays(parseInt(e.target.value))} style={{
            padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)',
            color: 'var(--text)', fontSize: 11, cursor: 'pointer',
          }}>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
          <button onClick={run} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 6,
            border: '1px solid var(--blue)', background: 'rgba(59,158,255,0.1)', color: 'var(--blue)',
            cursor: loading ? 'wait' : 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <Play size={12} /> {loading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>
        {/* Strategy selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {STRATEGIES.map(s => (
            <label key={s.id} onClick={() => setStrategy(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
              background: strategy === s.id ? 'var(--bg4)' : 'transparent',
              border: `1px solid ${strategy === s.id ? 'var(--blue)' : 'var(--border)'}`,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%', border: '2px solid',
                borderColor: strategy === s.id ? 'var(--blue)' : 'var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {strategy === s.id && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)' }} />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{s.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
            {[
              { l: 'Trades', v: result.totalTrades.toString(), c: 'var(--text)' },
              { l: 'Win Rate', v: `${result.winRate.toFixed(0)}%`, c: result.winRate >= 50 ? 'var(--green)' : 'var(--red)' },
              { l: 'Total Return', v: `${result.totalPnlPct >= 0 ? '+' : ''}${result.totalPnlPct.toFixed(1)}%`, c: result.totalPnlPct >= 0 ? 'var(--green)' : 'var(--red)' },
              { l: 'Max Drawdown', v: `${result.maxDrawdown.toFixed(1)}%`, c: 'var(--red)' },
              { l: 'Profit Factor', v: result.profitFactor.toFixed(2), c: result.profitFactor >= 1.5 ? 'var(--green)' : result.profitFactor >= 1 ? 'var(--amber)' : 'var(--red)' },
            ].map(s => (
              <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Trade log */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Trade Log ({result.trades.length})</div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {result.trades.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                  borderBottom: i < result.trades.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{t.date}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>${formatPrice(t.entry)} → ${formatPrice(t.exit)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: t.pnlPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                  </span>
                </div>
              ))}
              {result.trades.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text3)', padding: 12 }}>No trades generated — strategy didn't trigger in this period</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
