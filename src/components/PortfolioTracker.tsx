import { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Trash2, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { fetchTicker, fetchMultipleCryptoTickers, formatPrice, formatVolume, CRYPTO_SYMBOLS, FOREX_PAIRS, STOCK_SYMBOLS } from '../lib/api';
import type { Ticker, AssetClass } from '../lib/api';

interface Position {
  id: string; symbol: string; assetClass: AssetClass;
  amount: number; avgEntry: number;
}

const LS_KEY = 'signum_portfolio';

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function savePositions(p: Position[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {}
}

const ALL_SYMBOLS: { symbol: string; ac: AssetClass }[] = [
  ...CRYPTO_SYMBOLS.map(s=>({symbol:s,ac:'crypto' as AssetClass})),
  ...FOREX_PAIRS.map(s=>({symbol:s,ac:'forex' as AssetClass})),
  ...STOCK_SYMBOLS.map(s=>({symbol:s,ac:'stock' as AssetClass})),
];

export default function PortfolioTracker() {
  const [positions, setPositions] = useState<Position[]>(loadPositions);
  const [prices, setPrices]       = useState<Record<string, Ticker>>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string|null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date|null>(null);
  const [newSym, setNewSym]       = useState('BTC');
  const [newAmt, setNewAmt]       = useState('');
  const [newEntry, setNewEntry]   = useState('');
  const [fetchingEntry, setFetchingEntry] = useState(false);

  // Persist positions
  useEffect(() => { savePositions(positions); }, [positions]);

  // Fetch all prices
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const uniqueSymbols = [...new Set(positions.map(p => p.symbol))];
    if (uniqueSymbols.length === 0) { setLoading(false); return; }

    const map: Record<string, Ticker> = {};

    // Group by asset class for efficient fetching
    const cryptoSyms = uniqueSymbols.filter(s => positions.find(p => p.symbol === s)?.assetClass === 'crypto');
    const forexSyms  = uniqueSymbols.filter(s => positions.find(p => p.symbol === s)?.assetClass === 'forex');
    const stockSyms  = uniqueSymbols.filter(s => positions.find(p => p.symbol === s)?.assetClass === 'stock');

    try {
      // Crypto: batch fetch (single API call)
      if (cryptoSyms.length > 0) {
        const tickers = await fetchMultipleCryptoTickers(cryptoSyms);
        tickers.forEach(t => { map[t.symbol] = t; });
      }
      // Forex: sequential
      for (const sym of forexSyms) {
        try {
          const t = await fetchTicker(sym, 'forex');
          map[sym] = t;
        } catch {}
      }
      // Stocks: sequential
      for (const sym of stockSyms) {
        try {
          const t = await fetchTicker(sym, 'stock');
          map[sym] = t;
        } catch {}
      }

      setPrices(map);
      setLastUpdate(new Date());

      // Auto-fill avgEntry with current price for positions that have avgEntry=0
      setPositions(prev => prev.map(p => {
        if (p.avgEntry === 0 && map[p.symbol]) {
          return { ...p, avgEntry: map[p.symbol].price };
        }
        return p;
      }));
    } catch (e: any) {
      setError(e.message || 'Failed to fetch prices');
    }
    setLoading(false);
  }, [positions.map(p => p.symbol).join(',')]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Auto-fetch entry price when symbol changes in add form
  useEffect(() => {
    const found = ALL_SYMBOLS.find(x => x.symbol === newSym);
    if (!found) return;
    // If we already have the price cached, use it
    if (prices[newSym]) {
      setNewEntry(formatPrice(prices[newSym].price));
      return;
    }
    setFetchingEntry(true);
    fetchTicker(newSym, found.ac)
      .then(t => setNewEntry(formatPrice(t.price)))
      .catch(() => setNewEntry(''))
      .finally(() => setFetchingEntry(false));
  }, [newSym]);

  const add = () => {
    if (!newAmt || !newEntry) return;
    const found = ALL_SYMBOLS.find(x => x.symbol === newSym);
    if (!found) return;
    const pos: Position = {
      id: Date.now().toString(),
      symbol: newSym,
      assetClass: found.ac,
      amount: parseFloat(newAmt),
      avgEntry: parseFloat(newEntry.replace(/,/g, '')),
    };
    setPositions(prev => [...prev, pos]);
    setNewAmt('');
  };

  const remove = (id: string) => {
    setPositions(prev => prev.filter(x => x.id !== id));
  };

  // Calculations
  let totalValue = 0, totalCost = 0;
  const rows = positions.map(p => {
    const ticker = prices[p.symbol];
    const price = ticker?.price ?? p.avgEntry;
    const value = price * p.amount;
    const cost = p.avgEntry * p.amount;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    totalValue += value;
    totalCost += cost;
    return { ...p, price, value, pnl, pnlPct, ticker };
  });
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  // Allocation breakdown
  const allocByClass: Record<AssetClass, number> = { crypto: 0, forex: 0, stock: 0 };
  rows.forEach(r => { allocByClass[r.assetClass] += r.value; });

  const acColors: Record<AssetClass, string> = { crypto:'var(--green)', forex:'var(--blue)', stock:'var(--purple)' };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2 style={{fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
            <Wallet size={15} color="var(--purple)"/> Portfolio Tracker
          </h2>
          <p style={{fontSize:11,color:'var(--text3)'}}>
            Real-time prices · Auto-refresh 60s
            {lastUpdate && <> · Updated {lastUpdate.toLocaleTimeString()}</>}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',border:'1px solid var(--border)',borderRadius:6,background:'transparent',color:'var(--text2)',cursor:loading?'wait':'pointer',fontSize:12}}>
          <RefreshCw size={12} style={loading?{animation:'spin 1s linear infinite'}:undefined}/> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:6,background:'rgba(255,77,106,0.08)',border:'1px solid rgba(255,77,106,0.2)'}}>
          <AlertTriangle size={13} color="var(--red)"/>
          <span style={{fontSize:12,color:'var(--red)',flex:1}}>{error}</span>
          <button onClick={refresh} style={{padding:'3px 8px',borderRadius:4,border:'1px solid var(--red)',background:'rgba(255,77,106,0.1)',color:'var(--red)',cursor:'pointer',fontSize:10}}>Retry</button>
        </div>
      )}

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}>
          <div style={{fontSize:10,color:'var(--text3)',marginBottom:4,display:'flex',alignItems:'center',gap:4}}>
            <DollarSign size={10}/> Total Value
          </div>
          {loading && totalValue === 0 ? (
            <div style={{width:100,height:24,borderRadius:4,background:'var(--bg3)',animation:'pulse 1.5s infinite'}}/>
          ) : (
            <div style={{fontFamily:'var(--font-mono)',fontSize:20,fontWeight:700}}>${totalValue.toLocaleString('en-US',{maximumFractionDigits:0})}</div>
          )}
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}>
          <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>Total P&L</div>
          {loading && totalValue === 0 ? (
            <div style={{width:80,height:24,borderRadius:4,background:'var(--bg3)',animation:'pulse 1.5s infinite'}}/>
          ) : (
            <div style={{fontFamily:'var(--font-mono)',fontSize:20,fontWeight:700,color:totalPnl>=0?'var(--green)':'var(--red)'}}>
              {totalPnl>=0?'+':''}${Math.abs(totalPnl).toFixed(0)}
            </div>
          )}
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}>
          <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>Return</div>
          <div style={{fontFamily:'var(--font-mono)',fontSize:20,fontWeight:700,color:totalPnlPct>=0?'var(--green)':'var(--red)'}}>
            {totalPnlPct>=0?'+':''}{totalPnlPct.toFixed(2)}%
          </div>
        </div>
        <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}}>
          <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>Allocation</div>
          <div style={{display:'flex',gap:2,height:6,borderRadius:3,overflow:'hidden',marginBottom:6}}>
            {(['crypto','forex','stock'] as AssetClass[]).map(ac => {
              const pct = totalValue > 0 ? (allocByClass[ac] / totalValue) * 100 : 0;
              return pct > 0 ? <div key={ac} style={{width:`${pct}%`,background:acColors[ac],borderRadius:3}}/> : null;
            })}
          </div>
          <div style={{display:'flex',gap:8}}>
            {(['crypto','forex','stock'] as AssetClass[]).map(ac => {
              const pct = totalValue > 0 ? (allocByClass[ac] / totalValue) * 100 : 0;
              return pct > 0 ? (
                <span key={ac} style={{fontSize:9,fontFamily:'var(--font-mono)',color:acColors[ac]}}>
                  {ac.charAt(0).toUpperCase()+ac.slice(1)} {pct.toFixed(0)}%
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
        {/* Header */}
        <div style={{
          display:'grid', gridTemplateColumns:'40px 1fr 70px 90px 100px 100px 90px 90px 36px',
          padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:10,
          color:'var(--text3)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'.03em',
        }}>
          <span>#</span><span>Asset</span><span>Class</span><span style={{textAlign:'right'}}>Amount</span>
          <span style={{textAlign:'right'}}>Avg Entry</span><span style={{textAlign:'right'}}>Price</span>
          <span style={{textAlign:'right'}}>Value</span><span style={{textAlign:'right'}}>P&L</span><span/>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div style={{padding:'32px 16px',textAlign:'center',color:'var(--text3)',fontSize:13}}>
            No positions — add one below
          </div>
        ) : rows.map((r, i) => {
          const up = r.pnl >= 0;
          return (
            <div key={r.id} style={{
              display:'grid', gridTemplateColumns:'40px 1fr 70px 90px 100px 100px 90px 90px 36px',
              padding:'10px 12px', borderBottom: i < rows.length-1 ? '1px solid var(--border)' : 'none',
              alignItems:'center', transition:'background .1s',
            }}
              onMouseEnter={e => (e.currentTarget).style.background='var(--bg3)'}
              onMouseLeave={e => (e.currentTarget).style.background='transparent'}
            >
              <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>{i+1}</span>
              {/* Symbol + icon */}
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{
                  width:28,height:28,borderRadius:6,flexShrink:0,
                  background:`${acColors[r.assetClass]}12`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontFamily:'var(--font-mono)',fontSize:10,fontWeight:700,color:acColors[r.assetClass],
                }}>{r.symbol.slice(0,2)}</div>
                <div>
                  <div style={{fontSize:13,fontWeight:600}}>{r.symbol}</div>
                  {r.ticker && r.ticker.changePct24h !== 0 && (
                    <span style={{fontSize:9,color:r.ticker.changePct24h>=0?'var(--green)':'var(--red)',fontFamily:'var(--font-mono)'}}>
                      24h: {r.ticker.changePct24h>=0?'+':''}{r.ticker.changePct24h.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              {/* Class badge */}
              <span style={{fontSize:9,padding:'2px 6px',borderRadius:3,background:`${acColors[r.assetClass]}15`,color:acColors[r.assetClass],fontWeight:600,fontFamily:'var(--font-mono)',textTransform:'uppercase'}}>
                {r.assetClass}
              </span>
              {/* Amount */}
              <span style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11}}>{r.amount}</span>
              {/* Avg Entry */}
              <span style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text2)'}}>
                {r.assetClass === 'crypto' ? '$' : ''}{formatPrice(r.avgEntry)}
              </span>
              {/* Current price */}
              <span style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600}}>
                {loading && !r.ticker ? (
                  <span style={{display:'inline-block',width:50,height:14,borderRadius:3,background:'var(--bg4)',animation:'pulse 1.5s infinite'}}/>
                ) : (
                  <>{r.assetClass === 'crypto' ? '$' : ''}{formatPrice(r.price)}</>
                )}
              </span>
              {/* Value */}
              <span style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:11}}>
                ${r.value.toLocaleString('en-US',{maximumFractionDigits:0})}
              </span>
              {/* P&L */}
              <div style={{textAlign:'right'}}>
                <span style={{
                  display:'inline-flex',alignItems:'center',gap:3,
                  fontFamily:'var(--font-mono)',fontSize:11,fontWeight:600,
                  color:up?'var(--green)':'var(--red)',
                  padding:'2px 6px',borderRadius:4,
                  background:up?'rgba(0,212,170,.08)':'rgba(255,77,106,.08)',
                }}>
                  {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}
                  {up?'+':''}{r.pnlPct.toFixed(1)}%
                </span>
              </div>
              {/* Delete */}
              <button onClick={()=>remove(r.id)} style={{
                background:'none',border:'none',color:'var(--text3)',cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',
                borderRadius:4,padding:4,transition:'color .15s',
              }}
                onMouseEnter={e => (e.currentTarget).style.color='var(--red)'}
                onMouseLeave={e => (e.currentTarget).style.color='var(--text3)'}
              >
                <Trash2 size={13}/>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add position */}
      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:14}}>
        <div style={{fontSize:12,color:'var(--text2)',marginBottom:10,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
          <Plus size={13}/> Add Position
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <select value={newSym} onChange={e=>setNewSym(e.target.value)} style={{
            padding:'7px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',
            color:'var(--text)',fontFamily:'var(--font-mono)',fontSize:11,cursor:'pointer',
          }}>
            <optgroup label="Crypto">{CRYPTO_SYMBOLS.map(s=><option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Forex">{FOREX_PAIRS.map(s=><option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Stocks">{STOCK_SYMBOLS.map(s=><option key={s}>{s}</option>)}</optgroup>
          </select>

          <div style={{position:'relative'}}>
            <input placeholder="Amount" value={newAmt} onChange={e=>setNewAmt(e.target.value)} type="number" step="any"
              style={{width:100,padding:'7px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontFamily:'var(--font-mono)',fontSize:11}}/>
          </div>

          <div style={{position:'relative'}}>
            <input placeholder="Avg entry" value={newEntry} onChange={e=>setNewEntry(e.target.value)} type="text"
              style={{width:130,padding:'7px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--bg3)',color:'var(--text)',fontFamily:'var(--font-mono)',fontSize:11,
                paddingRight:fetchingEntry?28:10,
              }}/>
            {fetchingEntry && (
              <RefreshCw size={11} color="var(--text3)" style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',animation:'spin 1s linear infinite'}}/>
            )}
          </div>
          <span style={{fontSize:10,color:'var(--text3)'}}>← auto-filled with current price</span>

          <button onClick={add} disabled={!newAmt||!newEntry} style={{
            display:'flex',alignItems:'center',gap:5,padding:'7px 16px',borderRadius:6,
            border:'1px solid var(--green)',background:'rgba(0,212,170,0.1)',color:'var(--green)',
            cursor:!newAmt||!newEntry?'not-allowed':'pointer',fontSize:12,fontWeight:600,
            opacity:!newAmt||!newEntry?0.5:1,
          }}>
            <Plus size={13}/> Add
          </button>
        </div>
      </div>
    </div>
  );
}
