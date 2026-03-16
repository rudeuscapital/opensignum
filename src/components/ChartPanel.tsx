import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchOHLC, fetchTicker, computeRSI, computeEMA, computeMACD, computeBollinger, formatPrice, formatVolume, CRYPTO_SYMBOLS, FOREX_PAIRS, STOCK_SYMBOLS } from '../lib/api';
import type { AssetClass, CandleData, Ticker } from '../lib/api';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle, BarChart2 } from 'lucide-react';

const TABS: { label: string; ac: AssetClass; symbols: string[] }[] = [
  { label: 'Crypto', ac: 'crypto', symbols: CRYPTO_SYMBOLS.slice(0,6) },
  { label: 'Forex',  ac: 'forex',  symbols: FOREX_PAIRS.slice(0,6) },
  { label: 'Stocks', ac: 'stock',  symbols: STOCK_SYMBOLS.slice(0,6) },
];
const RANGES = [{ l:'7D',d:7 },{ l:'14D',d:14 },{ l:'30D',d:30 },{ l:'90D',d:90 }];

export default function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const seriesRef    = useRef<any>(null);
  const pendingData  = useRef<CandleData[]|null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [tabIdx, setTabIdx] = useState(0);
  const [symbol, setSymbol] = useState('BTC');
  const [days, setDays]     = useState(14);
  const [ticker, setTicker] = useState<Ticker|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string|null>(null);
  const [rsi, setRsi]   = useState(50);
  const [macd, setMacd] = useState({macd:0,signal:0,hist:0});
  const [bb, setBb]     = useState({upper:0,middle:0,lower:0});

  // ── Init chart (once) ─────────────────────────────────────────────────────
  useEffect(() => {
    let chart: any;
    let mounted = true;
    const init = async () => {
      const lc = await import('lightweight-charts');
      if (!containerRef.current || !mounted) return;
      chart = lc.createChart(containerRef.current, {
        layout:{ background:{type:lc.ColorType.Solid,color:'transparent'}, textColor:'#7a92a8' },
        grid:{ vertLines:{color:'#1a232d'}, horzLines:{color:'#1a232d'} },
        crosshair:{ mode:1 },
        rightPriceScale:{ borderColor:'#1e2a36' },
        timeScale:{ borderColor:'#1e2a36', timeVisible:true },
        width: containerRef.current.clientWidth, height: 380,
      });
      seriesRef.current = chart.addCandlestickSeries({
        upColor:'#00d4aa', downColor:'#ff4d6a',
        borderUpColor:'#00d4aa', borderDownColor:'#ff4d6a',
        wickUpColor:'#00a882', wickDownColor:'#cc2e4a',
      });
      chartRef.current = chart;
      setChartReady(true);

      // Apply pending data if data arrived before chart was ready
      if (pendingData.current) {
        seriesRef.current.setData(pendingData.current);
        chart.timeScale().fitContent();
        pendingData.current = null;
      }
    };
    init();
    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current)
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { mounted = false; chart?.remove(); ro.disconnect(); };
  }, []);

  // ── Reset symbol on tab change ────────────────────────────────────────────
  useEffect(() => {
    setSymbol(TABS[tabIdx].symbols[0]);
  }, [tabIdx]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const ac = TABS[tabIdx].ac;
    setLoading(true);
    setError(null);
    try {
      // Sequential to avoid CoinGecko rate limit
      const t = await fetchTicker(symbol, ac);
      setTicker(t);
      const c = await fetchOHLC(symbol, ac, days);

      // Apply to chart
      if (seriesRef.current) {
        seriesRef.current.setData(c);
        chartRef.current?.timeScale().fitContent();
      } else {
        // Chart not ready yet — store for later
        pendingData.current = c;
      }

      // Indicators
      const closes = c.map(x => x.close);
      setRsi(computeRSI(closes));
      setMacd(computeMACD(closes));
      setBb(computeBollinger(closes));
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    }
    setLoading(false);
  }, [symbol, days, tabIdx]);

  useEffect(() => { loadData(); }, [loadData]);

  const tab = TABS[tabIdx];
  const ema20Trend = ticker ? (ticker.price > ticker.low24h*1.01 ? 'up' : 'down') : 'up';

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Asset class tabs */}
      <div style={{display:'flex',gap:4}}>
        {TABS.map((t,i)=>(
          <button key={t.label} onClick={()=>setTabIdx(i)} style={{
            padding:'5px 14px',borderRadius:6,border:'1px solid',cursor:'pointer',
            borderColor:tabIdx===i?'var(--blue)':'var(--border)',
            background:tabIdx===i?'rgba(59,158,255,0.1)':'transparent',
            color:tabIdx===i?'var(--blue)':'var(--text2)',fontSize:12,fontWeight:600,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Symbol + range */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {tab.symbols.map(s=>(
            <button key={s} onClick={()=>setSymbol(s)} disabled={loading} style={{
              padding:'4px 10px',borderRadius:6,border:'1px solid',cursor:loading?'wait':'pointer',
              borderColor:symbol===s?'var(--green)':'var(--border)',
              background:symbol===s?'rgba(0,212,170,0.1)':'transparent',
              color:symbol===s?'var(--green)':'var(--text2)',
              fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,
              opacity:loading&&symbol!==s?0.5:1,
            }}>{s.replace('/','\u200B/')}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          {RANGES.map(r=>(
            <button key={r.l} onClick={()=>setDays(r.d)} disabled={loading} style={{
              padding:'4px 10px',borderRadius:6,border:'1px solid',cursor:loading?'wait':'pointer',
              borderColor:days===r.d?'var(--border2)':'transparent',
              background:days===r.d?'var(--bg4)':'transparent',
              color:days===r.d?'var(--text)':'var(--text2)',fontSize:12,
            }}>{r.l}</button>
          ))}
          <button onClick={loadData} disabled={loading} style={{
            padding:'4px 8px',borderRadius:6,border:'1px solid var(--border)',
            background:'transparent',cursor:loading?'wait':'pointer',color:'var(--text3)',
            display:'flex',alignItems:'center',
          }} title="Refresh">
            <RefreshCw size={13} style={loading?{animation:'spin 1s linear infinite'}:{}}/>
          </button>
        </div>
      </div>

      {/* Price header */}
      {ticker ? (
        <div style={{display:'flex',gap:20,alignItems:'baseline',flexWrap:'wrap'}}>
          <span style={{fontFamily:'var(--font-mono)',fontSize:24,fontWeight:700}}>${formatPrice(ticker.price)}</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:ticker.changePct24h>=0?'var(--green)':'var(--red)',display:'flex',alignItems:'center',gap:4}}>
            {ticker.changePct24h>=0?<TrendingUp size={13}/>:<TrendingDown size={13}/>}
            {ticker.changePct24h>=0?'+':''}{ticker.changePct24h.toFixed(3)}%
          </span>
          {ticker.volume24h>0&&<span style={{fontSize:12,color:'var(--text3)'}}>Vol: {formatVolume(ticker.volume24h)}</span>}
          <span style={{fontSize:12,color:'var(--text3)'}}>H: {formatPrice(ticker.high24h)} / L: {formatPrice(ticker.low24h)}</span>
        </div>
      ) : loading ? (
        <div style={{display:'flex',gap:12,alignItems:'baseline'}}>
          <div style={{width:160,height:28,borderRadius:6,background:'var(--bg3)',animation:'pulse 1.5s infinite'}}/>
          <div style={{width:80,height:16,borderRadius:4,background:'var(--bg3)',animation:'pulse 1.5s infinite'}}/>
        </div>
      ) : null}

      {/* Error banner */}
      {error && (
        <div style={{
          display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:8,
          background:'rgba(255,77,106,0.08)',border:'1px solid rgba(255,77,106,0.2)',
        }}>
          <AlertTriangle size={14} color="var(--red)"/>
          <span style={{fontSize:12,color:'var(--red)',flex:1}}>{error}</span>
          <button onClick={loadData} style={{
            padding:'4px 10px',borderRadius:4,border:'1px solid var(--red)',
            background:'rgba(255,77,106,0.1)',color:'var(--red)',cursor:'pointer',fontSize:11,fontWeight:600,
          }}>Retry</button>
        </div>
      )}

      {/* Chart container */}
      <div style={{position:'relative',borderRadius:8,overflow:'hidden',background:'var(--bg2)',border:'1px solid var(--border)',minHeight:380}}>
        {/* Loading overlay */}
        {loading && !chartReady && (
          <div style={{
            position:'absolute',inset:0,display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',gap:12,zIndex:10,
            background:'var(--bg2)',
          }}>
            <BarChart2 size={32} color="var(--text3)" style={{opacity:.3}}/>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <RefreshCw size={14} color="var(--green)" style={{animation:'spin 1s linear infinite'}}/>
              <span style={{fontSize:13,color:'var(--text2)'}}>Loading chart...</span>
            </div>
            <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>
              Fetching {symbol} {TABS[tabIdx].ac} data
            </span>
          </div>
        )}
        {/* Loading bar when switching symbols (chart already shown) */}
        {loading && chartReady && (
          <div style={{
            position:'absolute',top:0,left:0,right:0,height:2,zIndex:10,
            background:'var(--bg3)',overflow:'hidden',
          }}>
            <div style={{
              height:'100%',width:'40%',background:'linear-gradient(90deg,transparent,var(--green),transparent)',
              animation:'loadingBar 1.2s ease-in-out infinite',
            }}/>
          </div>
        )}
        <div ref={containerRef} style={{width:'100%'}}/>
      </div>

      {/* Indicators */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
        {[
          {label:'RSI (14)',value:rsi.toFixed(1),sub:rsi>70?'Overbought':rsi<30?'Oversold':'Neutral',color:rsi>70?'var(--red)':rsi<30?'var(--green)':'var(--text2)'},
          {label:'MACD',value:macd.hist>0?'Bullish':'Bearish',sub:`Hist: ${macd.hist.toFixed(5)}`,color:macd.hist>0?'var(--green)':'var(--red)'},
          {label:'Bollinger',value:ticker&&ticker.price>bb.upper?'Above upper':ticker&&ticker.price<bb.lower?'Below lower':'Inside band',sub:`Mid: ${formatPrice(bb.middle)}`,color:ticker&&ticker.price>bb.upper?'var(--red)':ticker&&ticker.price<bb.lower?'var(--green)':'var(--text2)'},
          {label:'Trend',value:ema20Trend==='up'?'Bullish':'Bearish',sub:'vs EMA 20',color:ema20Trend==='up'?'var(--green)':'var(--red)'},
        ].map(ind=>(
          <div key={ind.label} style={{padding:'10px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8}}>
            <div style={{fontSize:10,color:'var(--text3)',marginBottom:3}}>{ind.label}</div>
            {loading && !ticker ? (
              <div style={{width:60,height:16,borderRadius:4,background:'var(--bg3)',animation:'pulse 1.5s infinite',marginBottom:2}}/>
            ) : (
              <div style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:ind.color}}>{ind.value}</div>
            )}
            <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{ind.sub}</div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
