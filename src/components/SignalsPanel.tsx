import { useState, useEffect } from 'react';
import { Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, ChevronRight } from 'lucide-react';
import type { Signal, AssetClass } from '../lib/api';
import { formatPrice, CRYPTO_SYMBOLS, FOREX_PAIRS, STOCK_SYMBOLS } from '../lib/api';

const ASSET_TABS: { label: string; ac: AssetClass; symbols: string[] }[] = [
  { label:'Crypto', ac:'crypto', symbols: CRYPTO_SYMBOLS.slice(0,8) },
  { label:'Forex',  ac:'forex',  symbols: FOREX_PAIRS },
  { label:'Stocks', ac:'stock',  symbols: STOCK_SYMBOLS },
];

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{marginBottom:6}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
        <span style={{fontSize:11,color:'var(--text2)'}}>{label}</span>
        <span style={{fontFamily:'var(--font-mono)',fontSize:11,color}}>{value}/100</span>
      </div>
      <div style={{height:2,background:'var(--bg4)',borderRadius:2}}>
        <div style={{height:'100%',width:`${value}%`,background:color,borderRadius:2,transition:'width .5s ease'}}/>
      </div>
    </div>
  );
}

interface CardProps { signal: Signal; onDismiss:()=>void; }
function SignalCard({ signal, onDismiss }: CardProps) {
  const up=signal.type==='BUY'; const hold=signal.type==='HOLD';
  const tc=up?'var(--green)':hold?'var(--amber)':'var(--red)';
  const Icon=up?TrendingUp:hold?Minus:TrendingDown;
  return (
    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderLeft:`3px solid ${tc}`,borderRadius:8,padding:'14px 16px',animation:'fadeIn .3s ease'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700}}>{signal.symbol}</span>
          <span style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text3)',background:'var(--bg4)',padding:'1px 6px',borderRadius:3}}>
            {signal.assetClass.toUpperCase()}
          </span>
          <span style={{display:'flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:4,background:`${tc}22`,color:tc,fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700}}>
            <Icon size={11}/> {signal.type}
          </span>
          <span style={{padding:'2px 7px',borderRadius:4,fontSize:10,background:'var(--bg4)',color:signal.confidence>=70?'var(--green)':signal.confidence>=50?'var(--amber)':'var(--red)',fontFamily:'var(--font-mono)'}}>
            {signal.confidence}%
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:10,color:'var(--text3)',display:'flex',alignItems:'center',gap:3}}>
            <Clock size={10}/> {new Date(signal.timestamp).toLocaleTimeString()}
          </span>
          <button onClick={onDismiss} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:16}}>×</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginBottom:12}}>
        {[
          {l:'Entry',v:formatPrice(signal.entry),c:'var(--text)'},
          {l:'Stop loss',v:formatPrice(signal.sl),c:'var(--red)'},
          {l:'Take profit',v:formatPrice(signal.tp),c:'var(--green)'},
          {l:'R:R',v:`1:${signal.rr}`,c:'var(--blue)'},
        ].map(item=>(
          <div key={item.l} style={{background:'var(--bg3)',borderRadius:6,padding:'7px 9px'}}>
            <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>{item.l}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,color:item.c}}>{item.v}</div>
          </div>
        ))}
      </div>
      <ScoreBar label="Technical" value={signal.technicalScore} color="var(--blue)"/>
      <ScoreBar label="Fundamental" value={signal.fundamentalScore} color="var(--purple)"/>
      <ScoreBar label="Risk" value={signal.riskScore} color="var(--amber)"/>
      <p style={{fontSize:11,color:'var(--text2)',lineHeight:1.6,margin:'10px 0 0',padding:'8px 10px',background:'var(--bg3)',borderRadius:6}}>
        {signal.reason}
      </p>
    </div>
  );
}

export default function SignalsPanel() {
  const [tabIdx, setTabIdx] = useState(0);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [envStatus, setEnvStatus] = useState<{groq:boolean}|null>(null);

  useEffect(() => {
    fetch('/api/status').then(r => r.json()).then(setEnvStatus).catch(() => {});
  }, []);

  const groqReady = envStatus?.groq ?? false;

  const analyze = async (sym: string) => {
    if (!groqReady) { setError('AI engine not configured — check server settings'); return; }
    setLoading(sym); setError(null);
    try {
      const ac = ASSET_TABS[tabIdx].ac;
      const res = await fetch('/api/signals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, assetClass: ac }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signal generation failed');
      setSignals(prev => [data, ...prev].slice(0, 12));
    } catch (e: any) { setError(e.message ?? 'Analysis failed'); }
    setLoading(null);
  };

  const tab = ASSET_TABS[tabIdx];

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <h2 style={{fontSize:15,fontWeight:600,marginBottom:3,display:'flex',alignItems:'center',gap:8}}>
          <Zap size={15} color="var(--amber)"/> AI Signal Generator
        </h2>
        <p style={{fontSize:11,color:'var(--text3)'}}>Multi-asset · AI-powered analysis · Real-time market data</p>
      </div>

      {/* Env status badge */}
      {envStatus && (
        <div style={{display:'flex',gap:8}}>
          <span style={{fontSize:10,fontFamily:'var(--font-mono)',padding:'3px 8px',borderRadius:4,
            background:groqReady?'rgba(0,212,170,0.1)':'rgba(255,77,106,0.1)',
            color:groqReady?'var(--green)':'var(--red)',
            border:`1px solid ${groqReady?'rgba(0,212,170,0.2)':'rgba(255,77,106,0.2)'}`}}>
            AI: {groqReady?'Ready':'Not configured'}
          </span>
        </div>
      )}

      {/* Asset tabs */}
      <div style={{display:'flex',gap:4}}>
        {ASSET_TABS.map((t,i)=>(
          <button key={t.label} onClick={()=>setTabIdx(i)} style={{
            padding:'5px 14px',borderRadius:6,border:'1px solid',cursor:'pointer',
            borderColor:tabIdx===i?'var(--amber)':'var(--border)',
            background:tabIdx===i?'rgba(245,166,35,0.1)':'transparent',
            color:tabIdx===i?'var(--amber)':'var(--text2)',fontSize:12,fontWeight:600,
          }}>{t.label}</button>
        ))}
      </div>
      {/* Symbol buttons */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {tab.symbols.map(s=>(
          <button key={s} onClick={()=>analyze(s)} disabled={!!loading||!groqReady} style={{
            display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:6,
            border:'1px solid var(--border2)',background:loading===s?'rgba(0,212,170,0.1)':'var(--bg2)',
            color:loading===s?'var(--green)':!groqReady?'var(--text3)':'var(--text)',
            fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,cursor:loading||!groqReady?'wait':'pointer',
          }}>
            {loading===s?<span style={{animation:'pulse 1s infinite'}}>...</span>:<><ChevronRight size={11}/>{s}</>}
          </button>
        ))}
      </div>
      {error&&<div style={{padding:'8px 12px',borderRadius:6,background:'rgba(255,77,106,0.1)',border:'1px solid rgba(255,77,106,0.3)',color:'var(--red)',fontSize:12,display:'flex',alignItems:'center',gap:8}}>
        <AlertTriangle size={12}/>{error}
      </div>}
      {signals.length===0&&!loading&&(
        <div style={{padding:'36px 20px',textAlign:'center',border:'1px dashed var(--border)',borderRadius:8,color:'var(--text3)'}}>
          <Zap size={22} style={{marginBottom:8,opacity:.4}}/>
          <p style={{fontSize:13}}>{groqReady ? 'Select an asset above to generate a signal' : 'AI engine not configured — check server settings'}</p>
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {signals.map(s=>(
          <SignalCard key={s.id} signal={s} onDismiss={()=>setSignals(p=>p.filter(x=>x.id!==s.id))}/>
        ))}
      </div>
    </div>
  );
}
