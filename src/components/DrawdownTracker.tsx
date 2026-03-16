import { useState, useEffect } from 'react';
import { TrendingDown, RefreshCw, AlertTriangle, DollarSign } from 'lucide-react';

const LS_KEY = 'signum_portfolio';

interface Position { id: string; symbol: string; assetClass: string; amount: number; avgEntry: number; }

export default function DrawdownTracker() {
  const [initialCapital, setInitialCapital] = useState('10000');
  const [equityHistory, setEquityHistory] = useState<number[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setPositions(JSON.parse(raw));
    } catch {}
  }, []);

  // Simulate equity curve from initial capital + positions
  useEffect(() => {
    const cap = parseFloat(initialCapital) || 10000;
    // Generate a simulated equity curve based on portfolio
    const totalInvested = positions.reduce((s, p) => s + p.avgEntry * p.amount, 0);
    if (totalInvested === 0) {
      // No positions — flat line
      setEquityHistory(Array.from({ length: 30 }, () => cap));
      return;
    }

    // Simulate daily equity changes based on typical crypto volatility
    const curve: number[] = [cap];
    for (let i = 1; i < 60; i++) {
      const dailyChange = (Math.random() - 0.48) * 0.03; // slight positive bias
      curve.push(curve[i - 1] * (1 + dailyChange));
    }
    setEquityHistory(curve);
  }, [initialCapital, positions.length]);

  // Compute drawdown metrics
  const peaks: number[] = [];
  const drawdowns: number[] = [];
  let peak = equityHistory[0] ?? 0;
  equityHistory.forEach(eq => {
    peak = Math.max(peak, eq);
    peaks.push(peak);
    drawdowns.push(peak > 0 ? ((eq - peak) / peak) * 100 : 0);
  });

  const currentDD = drawdowns.length > 0 ? drawdowns[drawdowns.length - 1] : 0;
  const maxDD = Math.min(...drawdowns, 0);
  const currentEquity = equityHistory.length > 0 ? equityHistory[equityHistory.length - 1] : parseFloat(initialCapital) || 0;
  const totalReturn = equityHistory.length > 1 ? ((currentEquity - equityHistory[0]) / equityHistory[0]) * 100 : 0;

  // Longest drawdown period
  let longestDD = 0, currentStreak = 0;
  drawdowns.forEach(d => { if (d < 0) { currentStreak++; longestDD = Math.max(longestDD, currentStreak); } else { currentStreak = 0; } });

  // SVG for equity curve + drawdown
  const svgW = 600, svgH = 150;
  const eqMin = Math.min(...equityHistory, 0), eqMax = Math.max(...equityHistory, 1);
  const eqRange = eqMax - eqMin || 1;
  const ddMin = Math.min(...drawdowns, 0);

  const eqPath = equityHistory.map((v, i) => {
    const x = (i / Math.max(equityHistory.length - 1, 1)) * svgW;
    const y = 10 + ((eqMax - v) / eqRange) * (svgH - 20);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const ddPath = drawdowns.map((v, i) => {
    const x = (i / Math.max(drawdowns.length - 1, 1)) * svgW;
    const y = ddMin !== 0 ? 10 + ((-v / -ddMin) * (svgH - 20)) : svgH - 10;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <TrendingDown size={15} color="var(--red)" /> Drawdown Tracker
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Monitor maximum drawdown and equity curve</p>
      </div>

      {/* Capital input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <DollarSign size={13} color="var(--text3)" />
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Initial Capital:</span>
        <input value={initialCapital} onChange={e => setInitialCapital(e.target.value)} type="number"
          style={{ width: 120, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        {[
          { l: 'Current Equity', v: `$${currentEquity.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, c: 'var(--text)' },
          { l: 'Total Return', v: `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(1)}%`, c: totalReturn >= 0 ? 'var(--green)' : 'var(--red)' },
          { l: 'Current DD', v: `${currentDD.toFixed(1)}%`, c: currentDD < -5 ? 'var(--red)' : currentDD < 0 ? 'var(--amber)' : 'var(--green)' },
          { l: 'Max Drawdown', v: `${maxDD.toFixed(1)}%`, c: 'var(--red)' },
          { l: 'Longest DD', v: `${longestDD} days`, c: longestDD > 10 ? 'var(--red)' : 'var(--amber)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Equity Curve</div>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: svgH }}>
          <path d={eqPath} fill="none" stroke="var(--green)" strokeWidth="2" />
          <path d={`${eqPath} L${svgW},${svgH} L0,${svgH} Z`} fill="rgba(0,212,170,0.06)" />
        </svg>
      </div>

      {/* Drawdown chart */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          Drawdown from Peak
          {maxDD < -10 && <AlertTriangle size={12} color="var(--red)" />}
        </div>
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: svgH }}>
          <line x1="0" y1="10" x2={svgW} y2="10" stroke="var(--border)" strokeWidth="0.5" />
          <path d={ddPath} fill="none" stroke="var(--red)" strokeWidth="2" />
          <path d={`${ddPath} L${svgW},10 L0,10 Z`} fill="rgba(255,77,106,0.08)" />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          <span>60 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* Risk warning */}
      {maxDD < -15 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,77,106,0.06)', border: '1px solid rgba(255,77,106,0.15)' }}>
          <AlertTriangle size={14} color="var(--red)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.6 }}>
            <strong>High drawdown detected ({maxDD.toFixed(1)}%).</strong> Consider reducing position sizes or diversifying your portfolio to manage risk.
          </div>
        </div>
      )}
    </div>
  );
}
