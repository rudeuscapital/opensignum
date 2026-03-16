import { useState, useEffect, useCallback } from 'react';
import { Bell, BellRing, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Volume2 } from 'lucide-react';
import { fetchTicker, formatPrice, CRYPTO_SYMBOLS, FOREX_PAIRS, STOCK_SYMBOLS } from '../lib/api';
import type { AssetClass } from '../lib/api';

interface Alert {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  targetPrice: number;
  condition: 'above' | 'below';
  triggered: boolean;
  createdAt: number;
  triggeredAt?: number;
}

const LS_KEY = 'signum_alerts';
const ALL_SYMBOLS = [
  ...CRYPTO_SYMBOLS.map(s => ({ symbol: s, ac: 'crypto' as AssetClass })),
  ...FOREX_PAIRS.map(s => ({ symbol: s, ac: 'forex' as AssetClass })),
  ...STOCK_SYMBOLS.map(s => ({ symbol: s, ac: 'stock' as AssetClass })),
];

function loadAlerts(): Alert[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveAlerts(a: Alert[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch {}
}

export default function PriceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [newSym, setNewSym] = useState('BTC');
  const [newPrice, setNewPrice] = useState('');
  const [newCond, setNewCond] = useState<'above' | 'below'>('above');
  const [checking, setChecking] = useState(false);

  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const checkAlerts = useCallback(async () => {
    const active = alerts.filter(a => !a.triggered);
    if (active.length === 0) return;
    setChecking(true);

    const symbols = [...new Set(active.map(a => a.symbol))];
    const newPrices: Record<string, number> = {};

    for (const sym of symbols) {
      try {
        const found = ALL_SYMBOLS.find(x => x.symbol === sym);
        if (!found) continue;
        const t = await fetchTicker(sym, found.ac);
        newPrices[sym] = t.price;
      } catch {}
    }
    setPrices(prev => ({ ...prev, ...newPrices }));

    setAlerts(prev => prev.map(a => {
      if (a.triggered) return a;
      const price = newPrices[a.symbol];
      if (!price) return a;
      const hit = a.condition === 'above' ? price >= a.targetPrice : price <= a.targetPrice;
      if (hit) {
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Price Alert: ${a.symbol}`, {
            body: `${a.symbol} is now $${formatPrice(price)} (${a.condition} $${formatPrice(a.targetPrice)})`,
            icon: '/favicon.ico',
          });
        }
        return { ...a, triggered: true, triggeredAt: Date.now() };
      }
      return a;
    }));
    setChecking(false);
  }, [alerts]);

  // Check every 30s
  useEffect(() => {
    checkAlerts();
    const iv = setInterval(checkAlerts, 30000);
    return () => clearInterval(iv);
  }, [checkAlerts]);

  const addAlert = () => {
    if (!newPrice) return;
    const found = ALL_SYMBOLS.find(x => x.symbol === newSym);
    if (!found) return;
    const alert: Alert = {
      id: Date.now().toString(),
      symbol: newSym,
      assetClass: found.ac,
      targetPrice: parseFloat(newPrice),
      condition: newCond,
      triggered: false,
      createdAt: Date.now(),
    };
    setAlerts(prev => [alert, ...prev]);
    setNewPrice('');
  };

  const removeAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));
  const clearTriggered = () => setAlerts(prev => prev.filter(a => !a.triggered));

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'var(--bg3)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Bell size={15} color="var(--amber)" /> Price Alerts
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>
          Get notified when an asset hits your target price · Checks every 30s
          {checking && <span style={{ marginLeft: 8, color: 'var(--green)' }}>Checking...</span>}
        </p>
      </div>

      {/* Add alert */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={13} /> Create Alert
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={newSym} onChange={e => setNewSym(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <optgroup label="Crypto">{CRYPTO_SYMBOLS.map(s => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Forex">{FOREX_PAIRS.map(s => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Stocks">{STOCK_SYMBOLS.map(s => <option key={s}>{s}</option>)}</optgroup>
          </select>
          <select value={newCond} onChange={e => setNewCond(e.target.value as any)} style={{ ...inputStyle, cursor: 'pointer', width: 100 }}>
            <option value="above">Goes above</option>
            <option value="below">Goes below</option>
          </select>
          <input placeholder="Target price" value={newPrice} onChange={e => setNewPrice(e.target.value)}
            type="number" step="any" style={{ ...inputStyle, width: 130 }}
            onKeyDown={e => e.key === 'Enter' && addAlert()} />
          {prices[newSym] && (
            <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
              Now: ${formatPrice(prices[newSym])}
            </span>
          )}
          <button onClick={addAlert} disabled={!newPrice} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 16px', borderRadius: 6,
            border: '1px solid var(--amber)', background: 'rgba(245,166,35,0.1)', color: 'var(--amber)',
            cursor: !newPrice ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: !newPrice ? 0.5 : 1,
          }}>
            <Bell size={12} /> Set Alert
          </button>
        </div>
      </div>

      {/* Active alerts */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Volume2 size={13} color="var(--green)" /> Active ({activeAlerts.length})
        </div>
        {activeAlerts.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12 }}>
            No active alerts — create one above
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeAlerts.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--green)',
                  boxShadow: '0 0 6px var(--green)', animation: 'pulse 2s infinite',
                }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{a.symbol}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {a.condition === 'above' ? '≥' : '≤'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: a.condition === 'above' ? 'var(--green)' : 'var(--red)' }}>
                  ${formatPrice(a.targetPrice)}
                </span>
                {prices[a.symbol] && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                    Now: ${formatPrice(prices[a.symbol])}
                  </span>
                )}
                <button onClick={() => removeAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Triggered alerts */}
      {triggeredAlerts.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BellRing size={13} color="var(--amber)" /> Triggered ({triggeredAlerts.length})
            </span>
            <button onClick={clearTriggered} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {triggeredAlerts.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: 'rgba(245,166,35,0.04)', border: '1px solid rgba(245,166,35,0.15)', borderRadius: 8,
              }}>
                <CheckCircle size={14} color="var(--amber)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{a.symbol}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>hit {a.condition === 'above' ? '≥' : '≤'}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)' }}>${formatPrice(a.targetPrice)}</span>
                {a.triggeredAt && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
                    {new Date(a.triggeredAt).toLocaleString()}
                  </span>
                )}
                <button onClick={() => removeAlert(a.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
