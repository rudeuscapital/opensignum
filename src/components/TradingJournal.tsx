import { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, TrendingUp, TrendingDown, Download, Filter, Calendar } from 'lucide-react';
import { formatPrice, CRYPTO_SYMBOLS, FOREX_PAIRS, STOCK_SYMBOLS } from '../lib/api';
import type { AssetClass } from '../lib/api';

interface Trade {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  amount: number;
  entryDate: string;
  exitDate: string;
  pnl: number;
  pnlPct: number;
  notes: string;
  tags: string[];
}

const LS_KEY = 'signum_journal';
function loadTrades(): Trade[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveTrades(t: Trade[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(t)); } catch {}
}

const ALL_SYMBOLS = [
  ...CRYPTO_SYMBOLS.map(s => ({ symbol: s, ac: 'crypto' as AssetClass })),
  ...FOREX_PAIRS.map(s => ({ symbol: s, ac: 'forex' as AssetClass })),
  ...STOCK_SYMBOLS.map(s => ({ symbol: s, ac: 'stock' as AssetClass })),
];

const TAG_OPTIONS = ['Swing', 'Scalp', 'Breakout', 'Reversal', 'News', 'Technical', 'Fundamental', 'FOMO', 'Planned'];

export default function TradingJournal() {
  const [trades, setTrades] = useState<Trade[]>(loadTrades);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [form, setForm] = useState({
    symbol: 'BTC', side: 'LONG' as 'LONG' | 'SHORT',
    entryPrice: '', exitPrice: '', amount: '',
    entryDate: new Date().toISOString().split('T')[0],
    exitDate: new Date().toISOString().split('T')[0],
    notes: '', tags: [] as string[],
  });

  useEffect(() => { saveTrades(trades); }, [trades]);

  const addTrade = () => {
    if (!form.entryPrice || !form.exitPrice || !form.amount) return;
    const entry = parseFloat(form.entryPrice);
    const exit = parseFloat(form.exitPrice);
    const amount = parseFloat(form.amount);
    const pnl = form.side === 'LONG' ? (exit - entry) * amount : (entry - exit) * amount;
    const pnlPct = form.side === 'LONG' ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
    const found = ALL_SYMBOLS.find(x => x.symbol === form.symbol);

    const trade: Trade = {
      id: Date.now().toString(),
      symbol: form.symbol,
      assetClass: found?.ac ?? 'crypto',
      side: form.side,
      entryPrice: entry, exitPrice: exit, amount,
      entryDate: form.entryDate, exitDate: form.exitDate,
      pnl, pnlPct,
      notes: form.notes,
      tags: form.tags,
    };
    setTrades(prev => [trade, ...prev]);
    setShowForm(false);
    setForm(f => ({ ...f, entryPrice: '', exitPrice: '', amount: '', notes: '', tags: [] }));
  };

  const removeTrade = (id: string) => setTrades(prev => prev.filter(t => t.id !== id));

  const filtered = trades.filter(t => {
    if (filter === 'win') return t.pnl > 0;
    if (filter === 'loss') return t.pnl < 0;
    return true;
  });

  // Stats
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const avgWin = wins > 0 ? trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins : 0;
  const avgLoss = losses > 0 ? trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / losses : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  const exportCSV = () => {
    const headers = 'Date,Symbol,Side,Entry,Exit,Amount,P&L,P&L%,Tags,Notes\n';
    const rows = trades.map(t =>
      `${t.exitDate},${t.symbol},${t.side},${t.entryPrice},${t.exitPrice},${t.amount},${t.pnl.toFixed(2)},${t.pnlPct.toFixed(2)}%,"${t.tags.join(',')}","${t.notes.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <BookOpen size={15} color="var(--blue)" /> Trading Journal
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Log and analyze your trades</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={exportCSV} disabled={trades.length === 0} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
            cursor: trades.length === 0 ? 'not-allowed' : 'pointer', fontSize: 11, opacity: trades.length === 0 ? 0.5 : 1,
          }}>
            <Download size={12} /> Export CSV
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6,
            border: '1px solid var(--green)', background: 'rgba(0,212,170,0.1)', color: 'var(--green)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            <Plus size={13} /> Log Trade
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
        {[
          { l: 'Total Trades', v: totalTrades.toString(), c: 'var(--text)' },
          { l: 'Win Rate', v: `${winRate.toFixed(0)}%`, c: winRate >= 50 ? 'var(--green)' : 'var(--red)' },
          { l: 'Total P&L', v: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`, c: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
          { l: 'Avg Win', v: `+$${avgWin.toFixed(0)}`, c: 'var(--green)' },
          { l: 'Avg Loss', v: `-$${Math.abs(avgLoss).toFixed(0)}`, c: 'var(--red)' },
          { l: 'Profit Factor', v: profitFactor.toFixed(2), c: profitFactor >= 1.5 ? 'var(--green)' : profitFactor >= 1 ? 'var(--amber)' : 'var(--red)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Add trade form */}
      {showForm && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Log a Trade</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
            <select value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <optgroup label="Crypto">{CRYPTO_SYMBOLS.map(s => <option key={s}>{s}</option>)}</optgroup>
              <optgroup label="Forex">{FOREX_PAIRS.map(s => <option key={s}>{s}</option>)}</optgroup>
              <optgroup label="Stocks">{STOCK_SYMBOLS.map(s => <option key={s}>{s}</option>)}</optgroup>
            </select>
            <select value={form.side} onChange={e => setForm(f => ({ ...f, side: e.target.value as any }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
            <input type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} style={inputStyle} />
            <input type="date" value={form.exitDate} onChange={e => setForm(f => ({ ...f, exitDate: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
            <input placeholder="Entry price" value={form.entryPrice} onChange={e => setForm(f => ({ ...f, entryPrice: e.target.value }))} type="number" step="any" style={inputStyle} />
            <input placeholder="Exit price" value={form.exitPrice} onChange={e => setForm(f => ({ ...f, exitPrice: e.target.value }))} type="number" step="any" style={inputStyle} />
            <input placeholder="Amount/Qty" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" step="any" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
            {TAG_OPTIONS.map(tag => (
              <button key={tag} onClick={() => setForm(f => ({
                ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
              }))} style={{
                padding: '3px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer',
                border: '1px solid', fontFamily: 'var(--font-mono)',
                borderColor: form.tags.includes(tag) ? 'var(--blue)' : 'var(--border)',
                background: form.tags.includes(tag) ? 'rgba(59,158,255,0.1)' : 'transparent',
                color: form.tags.includes(tag) ? 'var(--blue)' : 'var(--text3)',
              }}>{tag}</button>
            ))}
          </div>
          <textarea placeholder="Notes (what went right/wrong, lessons learned...)"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ ...inputStyle, width: '100%', minHeight: 60, resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addTrade} style={{
              padding: '7px 18px', borderRadius: 6, border: '1px solid var(--green)',
              background: 'rgba(0,212,170,0.1)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>Save Trade</button>
            <button onClick={() => setShowForm(false)} style={{
              padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 12,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['all', 'win', 'loss'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            borderColor: filter === f ? 'var(--blue)' : 'var(--border)',
            background: filter === f ? 'rgba(59,158,255,0.1)' : 'transparent',
            color: filter === f ? 'var(--blue)' : 'var(--text2)',
          }}>{f === 'all' ? `All (${trades.length})` : f === 'win' ? `Wins (${wins})` : `Losses (${losses})`}</button>
        ))}
      </div>

      {/* Trade list */}
      {filtered.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)' }}>
          <BookOpen size={22} style={{ marginBottom: 8, opacity: .4 }} />
          <p style={{ fontSize: 13 }}>No trades logged yet — click "Log Trade" to start</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => {
            const win = t.pnl >= 0;
            return (
              <div key={t.id} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${win ? 'var(--green)' : 'var(--red)'}`,
                borderRadius: 8, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{t.symbol}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'var(--font-mono)',
                      background: t.side === 'LONG' ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)',
                      color: t.side === 'LONG' ? 'var(--green)' : 'var(--red)',
                    }}>{t.side}</span>
                    {t.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--bg4)', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: win ? 'var(--green)' : 'var(--red)' }}>
                      {win ? '+' : ''}{t.pnlPct.toFixed(1)}% ({win ? '+' : ''}${t.pnl.toFixed(0)})
                    </span>
                    <button onClick={() => removeTrade(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, fontSize: 11 }}>
                  <div><span style={{ color: 'var(--text3)' }}>Entry:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(t.entryPrice)}</span></div>
                  <div><span style={{ color: 'var(--text3)' }}>Exit:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(t.exitPrice)}</span></div>
                  <div><span style={{ color: 'var(--text3)' }}>Qty:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{t.amount}</span></div>
                  <div><span style={{ color: 'var(--text3)' }}>Date:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{t.exitDate}</span></div>
                </div>
                {t.notes && (
                  <p style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, marginTop: 8, padding: '6px 8px', background: 'var(--bg3)', borderRadius: 4 }}>
                    {t.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
