import { useState } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';

export default function RiskCalculator() {
  const [capital, setCapital] = useState(1000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry,   setEntry]   = useState(94000);
  const [sl,      setSl]      = useState(93000);
  const [tp,      setTp]      = useState(97000);

  const riskAmt = capital*(riskPct/100);
  const slDist  = Math.abs(entry-sl);
  const tpDist  = Math.abs(tp-entry);
  const lotSize = slDist>0 ? riskAmt/slDist : 0;
  const posVal  = lotSize*entry;
  const rr      = slDist>0 ? tpDist/slDist : 0;
  const profit  = lotSize*tpDist;
  const slPct   = entry>0 ? (slDist/entry)*100 : 0;
  const tpPct   = entry>0 ? (tpDist/entry)*100 : 0;
  const rrColor = rr>=2?'var(--green)':rr>=1.5?'var(--amber)':'var(--red)';

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div>
        <h2 style={{fontSize:15,fontWeight:600,display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
          <Shield size={15} color="var(--blue)"/> Risk Calculator
        </h2>
        <p style={{fontSize:11,color:'var(--text3)'}}>Position sizing · Stop loss · Take profit · R:R ratio</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {([
            {l:'Account capital (USD)', val:capital, set:setCapital, step:100, pre:'$'},
            {l:'Risk per trade (%)',    val:riskPct, set:setRiskPct, step:0.1, suf:'%', max:10},
            {l:'Entry price',          val:entry,   set:setEntry,   step:10,  pre:'$'},
            {l:'Stop loss price',      val:sl,      set:setSl,      step:10,  pre:'$'},
            {l:'Take profit price',    val:tp,      set:setTp,      step:10,  pre:'$'},
          ] as Array<{l:string;val:number;set:(v:number)=>void;step:number;pre?:string;suf?:string;max?:number}>).map(f=>(
            <div key={f.l}>
              <label style={{fontSize:11,color:'var(--text3)',display:'block',marginBottom:5}}>{f.l}</label>
              <div style={{position:'relative',display:'flex',alignItems:'center'}}>
                {f.pre&&<span style={{position:'absolute',left:10,fontSize:12,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>{f.pre}</span>}
                <input type="number" value={f.val} step={f.step} max={f.max}
                  onChange={e=>f.set(parseFloat(e.target.value)||0)}
                  style={{width:'100%',padding:`8px 10px 8px ${f.pre?'22px':'10px'}`,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontFamily:'var(--font-mono)',fontSize:12,outline:'none'}}/>
                {f.suf&&<span style={{position:'absolute',right:10,fontSize:12,color:'var(--text3)'}}>{f.suf}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{background:'var(--bg2)',border:`1px solid ${rrColor}44`,borderRadius:8,padding:'14px',textAlign:'center',marginBottom:4}}>
            <div style={{fontSize:10,color:'var(--text3)',marginBottom:4}}>Risk / Reward</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:30,fontWeight:700,color:rrColor}}>1 : {rr.toFixed(2)}</div>
            <div style={{fontSize:11,color:rrColor,marginTop:3}}>{rr>=2?'Good':rr>=1.5?'Acceptable':'Poor'}</div>
            {rr<1.5&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontSize:10,color:'var(--red)',marginTop:5}}>
              <AlertTriangle size={10}/> Consider adjusting TP
            </div>}
          </div>
          {[
            {l:'Max risk amount', v:`$${riskAmt.toFixed(2)}`, s:`${riskPct}% of capital`},
            {l:'Position size',   v:`${lotSize.toFixed(6)} units`, s:`≈ $${posVal.toFixed(0)}`},
            {l:'SL distance',     v:`-${slPct.toFixed(2)}%`, s:`$${slDist.toFixed(2)} per unit`},
            {l:'TP distance',     v:`+${tpPct.toFixed(2)}%`, s:`$${tpDist.toFixed(2)} per unit`},
            {l:'Profit potential',v:`$${profit.toFixed(2)}`, s:`if TP hit`},
          ].map(row=>(
            <div key={row.l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6}}>
              <span style={{fontSize:11,color:'var(--text3)'}}>{row.l}</span>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600}}>{row.v}</div>
                <div style={{fontSize:10,color:'var(--text3)'}}>{row.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:12}}>
        <div style={{fontSize:10,color:'var(--text3)',marginBottom:8}}>Price levels</div>
        <div style={{height:6,borderRadius:3,overflow:'hidden',display:'flex'}}>
          <div style={{flex:1,background:'var(--red)',opacity:.7}}/>
          <div style={{flex:1,background:'var(--green)',opacity:.7}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,fontSize:10,fontFamily:'var(--font-mono)'}}>
          <span style={{color:'var(--red)'}}>SL {sl.toLocaleString()}</span>
          <span style={{color:'var(--text2)'}}>Entry {entry.toLocaleString()}</span>
          <span style={{color:'var(--green)'}}>TP {tp.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
