import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, Shield, Wallet, BarChart2, ArrowUpRight, ArrowDownRight, RefreshCw, Globe, Clock, Eye, ScanSearch, LayoutGrid, Fish, Users, Trophy, Gauge, CalendarDays } from 'lucide-react';
import { fetchMultipleCryptoTickers, fetchForexTicker, fetchCryptoOHLC, computeRSI, formatPrice, formatVolume, CRYPTO_SYMBOLS, FOREX_PAIRS } from '../lib/api';
import type { Ticker } from '../lib/api';

interface Props { onNav: (tab:string)=>void; }

// Mini sparkline SVG from random data (placeholder until real data)
function Sparkline({ up, data }: { up: boolean; data?: number[] }) {
  const pts = data ?? Array.from({length:20}, () => 30 + Math.random() * 40);
  const mn = Math.min(...pts), mx = Math.max(...pts), rng = mx - mn || 1;
  const path = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * 80;
    const y = 2 + ((mx - v) / rng) * 26;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color = up ? 'var(--green)' : 'var(--red)';
  return (
    <svg viewBox="0 0 80 30" style={{ width:80, height:30 }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d={`${path} L80,30 L0,30 Z`} fill={`${up?'rgba(0,212,170,.08)':'rgba(255,77,106,.08)'}`}/>
    </svg>
  );
}

function FearGreedGauge({ value }: { value: number }) {
  const label = value <= 20 ? 'Extreme Fear' : value <= 40 ? 'Fear' : value <= 60 ? 'Neutral' : value <= 80 ? 'Greed' : 'Extreme Greed';
  const color = value <= 20 ? 'var(--red)' : value <= 40 ? '#ff8a4c' : value <= 60 ? 'var(--amber)' : value <= 80 ? '#7ddf64' : 'var(--green)';
  const angle = -90 + (value / 100) * 180;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <svg viewBox="0 0 120 70" style={{ width:120, height:70 }}>
        {/* Background arc */}
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="var(--border)" strokeWidth="8" strokeLinecap="round"/>
        {/* Colored arc */}
        <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(value/100)*157} 157`}
          style={{ filter:`drop-shadow(0 0 4px ${color})` }}/>
        {/* Needle */}
        <line x1="60" y1="60" x2={60 + 35 * Math.cos((angle * Math.PI) / 180)} y2={60 + 35 * Math.sin((angle * Math.PI) / 180)}
          stroke="var(--text)" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="60" cy="60" r="3" fill="var(--text)"/>
        {/* Value */}
        <text x="60" y="52" textAnchor="middle" style={{ fontSize:16, fontWeight:700, fontFamily:'var(--font-mono)', fill:color }}>{value}</text>
      </svg>
      <span style={{ fontSize:11, fontWeight:600, color }}>{label}</span>
    </div>
  );
}

export default function Dashboard({ onNav }: Props) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [forexTickers, setForexTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date|null>(null);
  const [globalData, setGlobalData] = useState<any>(null);
  const [btcRsi, setBtcRsi] = useState(50);

  const refresh = async () => {
    setLoading(true);
    try {
      const [cryptos, eur, gbp, global, ohlc] = await Promise.allSettled([
        fetchMultipleCryptoTickers(CRYPTO_SYMBOLS.slice(0,8)),
        fetchForexTicker('EUR/USD'),
        fetchForexTicker('GBP/USD'),
        fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()),
        fetchCryptoOHLC('BTC', 14),
      ]);
      if (cryptos.status === 'fulfilled') setTickers(cryptos.value);
      const fx: Ticker[] = [];
      if (eur.status === 'fulfilled') fx.push(eur.value);
      if (gbp.status === 'fulfilled') fx.push(gbp.value);
      setForexTickers(fx);
      if (global.status === 'fulfilled') setGlobalData(global.value.data);
      if (ohlc.status === 'fulfilled') setBtcRsi(computeRSI(ohlc.value.map(c => c.close)));
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60000);
    return () => clearInterval(iv);
  }, []);

  const gainers = [...tickers].sort((a,b) => b.changePct24h - a.changePct24h).slice(0,4);
  const losers  = [...tickers].sort((a,b) => a.changePct24h - b.changePct24h).slice(0,4);
  const totalMcap = globalData?.total_market_cap?.usd ?? 0;
  const totalVol  = globalData?.total_volume?.usd ?? 0;
  const btcDom    = globalData?.market_cap_percentage?.btc ?? 0;
  const ethDom    = globalData?.market_cap_percentage?.eth ?? 0;
  const mcapChange = globalData?.market_cap_change_percentage_24h_usd ?? 0;

  // Simulated fear/greed based on market data
  const fearGreed = Math.round(
    (btcRsi * 0.4) + ((mcapChange > 0 ? 50 + mcapChange * 3 : 50 + mcapChange * 3) * 0.3) + (btcDom > 50 ? 40 : 55) * 0.3
  );
  const clampedFG = Math.max(0, Math.min(100, fearGreed));

  const ACTIONS = [
    { id:'chart',     icon:BarChart2,  label:'Charts',       sub:'Candlestick + indicators', color:'var(--blue)' },
    { id:'signals',   icon:Zap,        label:'AI Signals',    sub:'AI-powered analysis',      color:'var(--amber)' },
    { id:'screener',  icon:ScanSearch,  label:'Screener',      sub:'Scan by RSI, MACD, EMA',   color:'var(--green)' },
    { id:'copytrade', icon:Users,       label:'Copy Trading',  sub:'Follow top traders',        color:'var(--purple)' },
  ];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* ── ROW 1: Global Stats ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Activity size={15} color="var(--green)"/>
          <span style={{ fontSize:15, fontWeight:600 }}>Market Overview</span>
          {loading && <RefreshCw size={12} color="var(--text3)" style={{ animation:'spin 1s linear infinite' }}/>}
        </div>
        {lastUpdate && (
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text3)' }}>
            <Clock size={10}/>
            Updated {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10 }}>
        {[
          { label:'Total Market Cap', value: totalMcap > 0 ? formatVolume(totalMcap) : '—', change: mcapChange, icon: Globe },
          { label:'24h Volume', value: totalVol > 0 ? formatVolume(totalVol) : '—', change: 0, icon: BarChart2 },
          { label:'BTC Dominance', value: btcDom > 0 ? `${btcDom.toFixed(1)}%` : '—', change: 0, icon: Activity },
          { label:'ETH Dominance', value: ethDom > 0 ? `${ethDom.toFixed(1)}%` : '—', change: 0, icon: Activity },
          { label:'BTC RSI (14)', value: btcRsi.toFixed(1), change: btcRsi > 50 ? 1 : -1, icon: TrendingUp },
        ].map((s, i) => (
          <div key={i} style={{
            background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <s.icon size={12} color="var(--text3)"/>
              <span style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.04em' }}>{s.label}</span>
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:18, fontWeight:700, marginBottom:4 }}>{s.value}</div>
            {s.change !== 0 && (
              <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:11 }}>
                {s.change > 0
                  ? <><ArrowUpRight size={11} color="var(--green)"/><span style={{color:'var(--green)'}}>+{typeof s.change==='number' && s.change > 1 ? s.change.toFixed(2)+'%' : 'Bullish'}</span></>
                  : <><ArrowDownRight size={11} color="var(--red)"/><span style={{color:'var(--red)'}}>{typeof s.change==='number' && s.change < -1 ? s.change.toFixed(2)+'%' : 'Bearish'}</span></>
                }
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── ROW 2: Quick Actions + Fear/Greed ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 200px', gap:12 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
          {ACTIONS.map(a => (
            <button key={a.id} onClick={() => onNav(a.id)} style={{
              background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 14px',
              textAlign:'left', cursor:'pointer', transition:'all .15s',
            }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor=a.color; (e.currentTarget).style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor='var(--border)'; (e.currentTarget).style.transform='none'; }}
            >
              <a.icon size={18} color={a.color} style={{ marginBottom:10 }}/>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:3 }}>{a.label}</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>{a.sub}</div>
            </button>
          ))}
        </div>
        {/* Fear/Greed */}
        <div style={{
          background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        }}>
          <span style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Market Sentiment</span>
          <FearGreedGauge value={clampedFG}/>
        </div>
      </div>

      {/* ── ROW 3: Feature Grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
        {[
          { id:'multichart',  icon:LayoutGrid,  label:'Multi-Chart',   color:'var(--blue)' },
          { id:'feargreed',   icon:Gauge,        label:'Fear & Greed',  color:'var(--amber)' },
          { id:'whale',       icon:Fish,          label:'Whale Tracker', color:'var(--purple)' },
          { id:'leaderboard', icon:Trophy,        label:'Leaderboard',   color:'var(--amber)' },
          { id:'pnlcalendar', icon:CalendarDays,  label:'P&L Calendar',  color:'var(--green)' },
          { id:'portfolio',   icon:Wallet,        label:'Portfolio',     color:'var(--blue)' },
        ].map(f => (
          <button key={f.id} onClick={() => onNav(f.id)} style={{
            background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8,
            padding:'12px 10px', textAlign:'center', cursor:'pointer', transition:'all .15s',
          }}
            onMouseEnter={e => { (e.currentTarget).style.borderColor=f.color; (e.currentTarget).style.transform='translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget).style.borderColor='var(--border)'; (e.currentTarget).style.transform='none'; }}
          >
            <f.icon size={16} color={f.color} style={{ marginBottom:6 }}/>
            <div style={{ fontSize:11, fontWeight:500, color:'var(--text2)' }}>{f.label}</div>
          </button>
        ))}
      </div>

      {/* ── ROW 4: Crypto Watchlist ── */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Eye size={13} color="var(--text3)"/>
            <span style={{ fontSize:13, fontWeight:600 }}>Crypto Watchlist</span>
          </div>
          <button onClick={() => onNav('chart')} style={{
            background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:11,
            display:'flex', alignItems:'center', gap:4,
          }}>View all <ArrowUpRight size={11}/></button>
        </div>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          {/* Table header */}
          <div style={{
            display:'grid', gridTemplateColumns:'40px 1fr 120px 100px 80px 80px',
            padding:'8px 14px', borderBottom:'1px solid var(--border)', fontSize:10,
            color:'var(--text3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'.04em',
          }}>
            <span>#</span><span>Asset</span><span style={{textAlign:'right'}}>Price</span>
            <span style={{textAlign:'right'}}>24h %</span><span style={{textAlign:'right'}}>Volume</span><span></span>
          </div>
          {/* Table rows */}
          {tickers.map((t, i) => {
            const up = t.changePct24h >= 0;
            return (
              <div key={t.symbol}
                onClick={() => onNav('chart')}
                style={{
                  display:'grid', gridTemplateColumns:'40px 1fr 120px 100px 80px 80px',
                  padding:'10px 14px', borderBottom: i < tickers.length-1 ? '1px solid var(--border)' : 'none',
                  alignItems:'center', cursor:'pointer', transition:'background .12s',
                }}
                onMouseEnter={e => (e.currentTarget).style.background='var(--bg3)'}
                onMouseLeave={e => (e.currentTarget).style.background='transparent'}
              >
                <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>{i+1}</span>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{
                    width:28, height:28, borderRadius:6,
                    background:`${up?'rgba(0,212,170,.08)':'rgba(255,77,106,.08)'}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700,
                    color: up ? 'var(--green)' : 'var(--red)',
                  }}>{t.symbol.slice(0,2)}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{t.symbol}</div>
                    <div style={{ fontSize:10, color:'var(--text3)' }}>{t.marketCap ? 'MCap ' + formatVolume(t.marketCap) : ''}</div>
                  </div>
                </div>
                <span style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700 }}>${formatPrice(t.price)}</span>
                <div style={{ textAlign:'right' }}>
                  <span style={{
                    fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700,
                    color: up ? 'var(--green)' : 'var(--red)',
                    padding:'2px 8px', borderRadius:4,
                    background: up ? 'rgba(0,212,170,.1)' : 'rgba(255,77,106,.1)',
                  }}>
                    {up?'+':''}{t.changePct24h.toFixed(2)}%
                  </span>
                </div>
                <span style={{ textAlign:'right', fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>
                  {formatVolume(t.volume24h)}
                </span>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <Sparkline up={up}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ROW 4: Forex + Gainers/Losers ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        {/* Forex */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
            <Globe size={13} color="var(--blue)"/>
            <span style={{ fontSize:12, fontWeight:600 }}>Forex Rates</span>
          </div>
          {forexTickers.map(t => (
            <div key={t.symbol} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600 }}>{t.symbol}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{t.price.toFixed(4)}</span>
            </div>
          ))}
          {forexTickers.length === 0 && <p style={{ fontSize:11, color:'var(--text3)', textAlign:'center', padding:12 }}>Loading...</p>}
          <button onClick={() => onNav('chart')} style={{
            width:'100%', marginTop:10, padding:'6px', borderRadius:6,
            background:'rgba(59,158,255,.06)', border:'1px solid rgba(59,158,255,.15)',
            color:'var(--blue)', fontSize:11, cursor:'pointer', fontWeight:500,
          }}>View all pairs →</button>
        </div>

        {/* Gainers */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, color:'var(--green)' }}>
            <TrendingUp size={13}/>
            <span style={{ fontSize:12, fontWeight:600 }}>Top Gainers (24h)</span>
          </div>
          {gainers.map(t => (
            <div key={t.symbol} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'8px 0', borderBottom:'1px solid var(--border)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <ArrowUpRight size={11} color="var(--green)"/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700 }}>{t.symbol}</span>
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)' }}>${formatPrice(t.price)}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--green)', fontWeight:700 }}>+{t.changePct24h.toFixed(2)}%</span>
            </div>
          ))}
        </div>

        {/* Losers */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, color:'var(--red)' }}>
            <TrendingDown size={13}/>
            <span style={{ fontSize:12, fontWeight:600 }}>Top Losers (24h)</span>
          </div>
          {losers.map(t => (
            <div key={t.symbol} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'8px 0', borderBottom:'1px solid var(--border)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <ArrowDownRight size={11} color="var(--red)"/>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700 }}>{t.symbol}</span>
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)' }}>${formatPrice(t.price)}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--red)', fontWeight:700 }}>{t.changePct24h.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ROW 5: API Status ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
        {[
          { name:'Crypto Feed',  desc:'Real-time prices', status:'Active', color:'var(--green)' },
          { name:'Forex Feed',   desc:'Currency rates',   status:'Active', color:'var(--blue)' },
          { name:'Stocks Feed',  desc:'Equities data',    status:'Active', color:'var(--purple)' },
          { name:'AI Engine',    desc:'Signal generation', status:'Active', color:'var(--amber)' },
        ].map(api => (
          <div key={api.name} style={{
            background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px',
            display:'flex', alignItems:'center', gap:10,
          }}>
            <div style={{
              width:6, height:6, borderRadius:'50%', background:api.color,
              boxShadow:`0 0 6px ${api.color}`,
            }}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:500, color:api.color }}>{api.name}</div>
              <div style={{ fontSize:10, color:'var(--text3)', marginTop:1 }}>{api.desc}</div>
            </div>
            <span style={{
              fontSize:9, fontFamily:'var(--font-mono)', color:api.color,
              padding:'2px 6px', borderRadius:3,
              background:`${api.color}15`, border:`1px solid ${api.color}25`,
            }}>{api.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
