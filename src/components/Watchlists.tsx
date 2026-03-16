import { useState, useEffect, useCallback } from 'react';
import { Eye, Plus, Trash2, Edit3, Check, Star, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { fetchMultipleCryptoTickers, fetchTicker, formatPrice, formatVolume, CRYPTO_SYMBOLS, FOREX_PAIRS, STOCK_SYMBOLS } from '../lib/api';
import type { Ticker, AssetClass } from '../lib/api';

interface WatchlistItem { symbol: string; assetClass: AssetClass; notes: string; }
interface Watchlist { id: string; name: string; items: WatchlistItem[]; }

const LS_KEY = 'signum_watchlists';
function load(): Watchlist[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function save(w: Watchlist[]) { try { localStorage.setItem(LS_KEY, JSON.stringify(w)); } catch {} }

const ALL_SYMBOLS = [
  ...CRYPTO_SYMBOLS.map(s => ({ symbol: s, ac: 'crypto' as AssetClass })),
  ...FOREX_PAIRS.map(s => ({ symbol: s, ac: 'forex' as AssetClass })),
  ...STOCK_SYMBOLS.map(s => ({ symbol: s, ac: 'stock' as AssetClass })),
];

export default function Watchlists() {
  const [lists, setLists] = useState<Watchlist[]>(load);
  const [activeId, setActiveId] = useState(lists[0]?.id ?? '');
  const [prices, setPrices] = useState<Record<string, Ticker>>({});
  const [loading, setLoading] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [addSym, setAddSym] = useState('BTC');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const active = lists.find(l => l.id === activeId);

  useEffect(() => { save(lists); }, [lists]);

  const refresh = useCallback(async () => {
    if (!active || active.items.length === 0) return;
    setLoading(true);
    const map: Record<string, Ticker> = {};
    const cryptoSyms = active.items.filter(i => i.assetClass === 'crypto').map(i => i.symbol);
    if (cryptoSyms.length > 0) {
      try {
        const tickers = await fetchMultipleCryptoTickers(cryptoSyms);
        tickers.forEach(t => { map[t.symbol] = t; });
      } catch {}
    }
    for (const item of active.items.filter(i => i.assetClass !== 'crypto')) {
      try { const t = await fetchTicker(item.symbol, item.assetClass); map[item.symbol] = t; } catch {}
    }
    setPrices(prev => ({ ...prev, ...map }));
    setLoading(false);
  }, [activeId, active?.items.length]);

  useEffect(() => { refresh(); }, [refresh]);

  const addList = () => {
    if (!newListName.trim()) return;
    const nl: Watchlist = { id: Date.now().toString(), name: newListName.trim(), items: [] };
    setLists(prev => [...prev, nl]);
    setActiveId(nl.id);
    setNewListName('');
  };

  const removeList = (id: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (activeId === id) setActiveId(lists[0]?.id ?? '');
  };

  const addItem = () => {
    if (!active) return;
    const found = ALL_SYMBOLS.find(x => x.symbol === addSym);
    if (!found) return;
    if (active.items.some(i => i.symbol === addSym)) return;
    setLists(prev => prev.map(l =>
      l.id === activeId ? { ...l, items: [...l.items, { symbol: addSym, assetClass: found.ac, notes: '' }] } : l
    ));
  };

  const removeItem = (sym: string) => {
    setLists(prev => prev.map(l =>
      l.id === activeId ? { ...l, items: l.items.filter(i => i.symbol !== sym) } : l
    ));
  };

  const saveNote = (sym: string) => {
    setLists(prev => prev.map(l =>
      l.id === activeId ? { ...l, items: l.items.map(i => i.symbol === sym ? { ...i, notes: noteText } : i) } : l
    ));
    setEditingNote(null);
  };

  const acColors: Record<AssetClass, string> = { crypto: 'var(--green)', forex: 'var(--blue)', stock: 'var(--purple)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Eye size={15} color="var(--amber)" /> Watchlists
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Track assets with custom notes</p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
          cursor: loading ? 'wait' : 'pointer', fontSize: 11,
        }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Refresh
        </button>
      </div>

      {/* Watchlist tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {lists.map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button onClick={() => setActiveId(l.id)} style={{
              padding: '5px 12px', borderRadius: '6px 0 0 6px', border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              borderColor: activeId === l.id ? 'var(--amber)' : 'var(--border)',
              background: activeId === l.id ? 'rgba(245,166,35,0.1)' : 'transparent',
              color: activeId === l.id ? 'var(--amber)' : 'var(--text2)',
            }}>
              <Star size={10} style={{ marginRight: 4 }} />{l.name} ({l.items.length})
            </button>
            {lists.length > 1 && (
              <button onClick={() => removeList(l.id)} style={{
                padding: '5px 6px', borderRadius: '0 6px 6px 0', border: '1px solid var(--border)', borderLeft: 'none',
                background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 10,
              }}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 4 }}>
          <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="New list..."
            onKeyDown={e => e.key === 'Enter' && addList()}
            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 11, width: 100 }} />
          <button onClick={addList} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--green)', background: 'rgba(0,212,170,0.1)', color: 'var(--green)', cursor: 'pointer' }}>
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Add symbol */}
      {active && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={addSym} onChange={e => setAddSym(e.target.value)} style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)',
            color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
          }}>
            <optgroup label="Crypto">{CRYPTO_SYMBOLS.map(s => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Forex">{FOREX_PAIRS.map(s => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Stocks">{STOCK_SYMBOLS.map(s => <option key={s}>{s}</option>)}</optgroup>
          </select>
          <button onClick={addItem} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6,
            border: '1px solid var(--green)', background: 'rgba(0,212,170,0.1)', color: 'var(--green)',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
          }}>
            <Plus size={12} /> Add to {active.name}
          </button>
        </div>
      )}

      {/* Items */}
      {active && active.items.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12 }}>
          Empty watchlist — add symbols above
        </div>
      ) : active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {active.items.map(item => {
            const t = prices[item.symbol];
            const up = t ? t.changePct24h >= 0 : true;
            return (
              <div key={item.symbol} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6, background: `${acColors[item.assetClass]}12`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: acColors[item.assetClass],
                  }}>{item.symbol.slice(0, 2)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{item.symbol}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${acColors[item.assetClass]}15`, color: acColors[item.assetClass], fontFamily: 'var(--font-mono)' }}>
                        {item.assetClass}
                      </span>
                    </div>
                    {t && (
                      <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>${formatPrice(t.price)}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: up ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {up ? '+' : ''}{t.changePct24h.toFixed(2)}%
                        </span>
                        {t.volume24h > 0 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>Vol: {formatVolume(t.volume24h)}</span>}
                      </div>
                    )}
                    {!t && loading && <div style={{ width: 80, height: 14, borderRadius: 3, background: 'var(--bg3)', animation: 'pulse 1.5s infinite', marginTop: 4 }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => { setEditingNote(editingNote === item.symbol ? null : item.symbol); setNoteText(item.notes); }}
                      style={{ background: 'none', border: 'none', color: item.notes ? 'var(--amber)' : 'var(--text3)', cursor: 'pointer' }}>
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => removeItem(item.symbol)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {/* Notes editor */}
                {editingNote === item.symbol && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add notes..."
                      onKeyDown={e => e.key === 'Enter' && saveNote(item.symbol)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 11 }} />
                    <button onClick={() => saveNote(item.symbol)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--green)', background: 'rgba(0,212,170,0.1)', color: 'var(--green)', cursor: 'pointer' }}>
                      <Check size={12} />
                    </button>
                  </div>
                )}
                {item.notes && editingNote !== item.symbol && (
                  <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6, padding: '4px 8px', background: 'var(--bg3)', borderRadius: 4 }}>{item.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
