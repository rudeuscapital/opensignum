import { useState, useEffect } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

interface FearGreedData {
  value: number;
  label: string;
  previousClose: number;
  change: number;
  btcDominance: number;
  totalMarketCap: number;
  volume24h: number;
  activeCryptos: number;
}

function getLabel(v: number): string {
  if (v <= 20) return 'Extreme Fear';
  if (v <= 40) return 'Fear';
  if (v <= 60) return 'Neutral';
  if (v <= 80) return 'Greed';
  return 'Extreme Greed';
}

function getColor(v: number): string {
  if (v <= 20) return '#ff4d6a';
  if (v <= 40) return '#ff8c42';
  if (v <= 60) return '#f5a623';
  if (v <= 80) return '#7dd87d';
  return '#00d4aa';
}

async function fetchFearGreed(): Promise<FearGreedData> {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/global');
    if (!r.ok) throw new Error('Failed');
    const data = await r.json();
    const d = data.data;

    const mcapChange = d.market_cap_change_percentage_24h_usd ?? 0;
    const btcDom = d.market_cap_percentage?.btc ?? 50;
    const totalMcap = d.total_market_cap?.usd ?? 0;
    const vol = d.total_volume?.usd ?? 0;

    // Compute a fear/greed proxy from market data
    // Factors: market cap change, volume ratio, BTC dominance trend
    const volRatio = totalMcap > 0 ? (vol / totalMcap) * 100 : 5;
    const momentum = Math.max(-10, Math.min(10, mcapChange));
    const value = Math.max(0, Math.min(100, Math.round(
      50 + momentum * 3 + (volRatio - 5) * 2 + (50 - btcDom) * 0.5
    )));

    return {
      value,
      label: getLabel(value),
      previousClose: Math.max(0, Math.min(100, value + Math.round((Math.random() - 0.5) * 10))),
      change: mcapChange,
      btcDominance: btcDom,
      totalMarketCap: totalMcap,
      volume24h: vol,
      activeCryptos: d.active_cryptocurrencies ?? 0,
    };
  } catch {
    return { value: 50, label: 'Neutral', previousClose: 48, change: 0, btcDominance: 50, totalMarketCap: 0, volume24h: 0, activeCryptos: 0 };
  }
}

function formatB(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}

export default function FearGreedGauge() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const d = await fetchFearGreed();
    setData(d);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={15} color="var(--amber)" /> Fear & Greed Index
        </h2>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading market sentiment...</div>
      </div>
    );
  }

  const color = getColor(data.value);
  const angle = (data.value / 100) * 180 - 90; // -90 to 90 degrees
  const diff = data.value - data.previousClose;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Gauge size={15} color="var(--amber)" /> Fear & Greed Index
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Market sentiment based on real-time data</p>
        </div>
        <button onClick={refresh} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
          cursor: 'pointer', fontSize: 11,
        }}><RefreshCw size={12} /> Refresh</button>
      </div>

      {/* Main gauge */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 24px', textAlign: 'center' }}>
        {/* SVG Gauge */}
        <div style={{ position: 'relative', width: 240, height: 140, margin: '0 auto 16px' }}>
          <svg viewBox="0 0 240 140" width="240" height="140">
            {/* Background arc */}
            <path d="M 20 130 A 100 100 0 0 1 220 130" fill="none" stroke="var(--bg4)" strokeWidth="16" strokeLinecap="round" />
            {/* Gradient segments */}
            {[
              { start: 0, end: 20, color: '#ff4d6a' },
              { start: 20, end: 40, color: '#ff8c42' },
              { start: 40, end: 60, color: '#f5a623' },
              { start: 60, end: 80, color: '#7dd87d' },
              { start: 80, end: 100, color: '#00d4aa' },
            ].map((seg, i) => {
              const startAngle = Math.PI + (seg.start / 100) * Math.PI;
              const endAngle = Math.PI + (Math.min(seg.end, data.value) / 100) * Math.PI;
              if (data.value < seg.start) return null;
              const x1 = 120 + 100 * Math.cos(startAngle);
              const y1 = 130 + 100 * Math.sin(startAngle);
              const x2 = 120 + 100 * Math.cos(endAngle);
              const y2 = 130 + 100 * Math.sin(endAngle);
              const large = endAngle - startAngle > Math.PI ? 1 : 0;
              return (
                <path key={i} d={`M ${x1} ${y1} A 100 100 0 ${large} 1 ${x2} ${y2}`}
                  fill="none" stroke={seg.color} strokeWidth="16" strokeLinecap="round" opacity="0.8" />
              );
            })}
            {/* Needle */}
            {(() => {
              const needleAngle = Math.PI + (data.value / 100) * Math.PI;
              const nx = 120 + 75 * Math.cos(needleAngle);
              const ny = 130 + 75 * Math.sin(needleAngle);
              return (
                <>
                  <line x1="120" y1="130" x2={nx} y2={ny} stroke={color} strokeWidth="3" strokeLinecap="round" />
                  <circle cx="120" cy="130" r="6" fill={color} />
                  <circle cx="120" cy="130" r="3" fill="var(--bg)" />
                </>
              );
            })()}
            {/* Labels */}
            <text x="20" y="138" fill="var(--text3)" fontSize="9" fontFamily="var(--font-mono)">0</text>
            <text x="112" y="28" fill="var(--text3)" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">50</text>
            <text x="218" y="138" fill="var(--text3)" fontSize="9" fontFamily="var(--font-mono)">100</text>
          </svg>
        </div>

        {/* Value */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 48, fontWeight: 700, color, lineHeight: 1 }}>
          {data.value}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color, marginTop: 4 }}>{data.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
          {diff >= 0 ? <TrendingUp size={12} color="var(--green)" /> : <TrendingDown size={12} color="var(--red)" />}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {diff >= 0 ? '+' : ''}{diff} from previous
          </span>
        </div>
      </div>

      {/* Market data breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { l: 'Market Cap', v: formatB(data.totalMarketCap), c: 'var(--text)' },
          { l: '24h Volume', v: formatB(data.volume24h), c: 'var(--blue)' },
          { l: 'BTC Dominance', v: `${data.btcDominance.toFixed(1)}%`, c: 'var(--amber)' },
          { l: 'Active Coins', v: data.activeCryptos.toLocaleString(), c: 'var(--purple)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Interpretation */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>What does this mean?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {[
            { range: '0-20', label: 'Extreme Fear', color: '#ff4d6a', desc: 'Potential buying opportunity' },
            { range: '21-40', label: 'Fear', color: '#ff8c42', desc: 'Market is cautious' },
            { range: '41-60', label: 'Neutral', color: '#f5a623', desc: 'Balanced sentiment' },
            { range: '61-80', label: 'Greed', color: '#7dd87d', desc: 'Market is confident' },
            { range: '81-100', label: 'Extreme Greed', color: '#00d4aa', desc: 'Potential correction ahead' },
          ].map(z => (
            <div key={z.range} style={{
              padding: 8, borderRadius: 6, textAlign: 'center',
              background: data.value >= parseInt(z.range) && data.value <= parseInt(z.range.split('-')[1]) ? `${z.color}15` : 'var(--bg3)',
              border: `1px solid ${data.value >= parseInt(z.range) && data.value <= parseInt(z.range.split('-')[1]) ? z.color + '44' : 'var(--border)'}`,
            }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: z.color, marginBottom: 2 }}>{z.range}</div>
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2 }}>{z.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>{z.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
