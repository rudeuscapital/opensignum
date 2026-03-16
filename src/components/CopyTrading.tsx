import { useState, useMemo } from 'react';
import { Users, Copy, Plus, Trash2, TrendingUp, TrendingDown, Minus, Share2, Eye, Star, Check } from 'lucide-react';
import type { Signal } from '../lib/api';
import { formatPrice } from '../lib/api';

interface SharedSignal extends Signal {
  sharedBy: string;
  sharedAt: number;
  likes: number;
  copies: number;
  verified: boolean;
}

interface Provider {
  address: string;
  signals: number;
  winRate: number;
  avgReturn: number;
  followers: number;
  following: boolean;
}

const LS_SIGNALS = 'signum_shared_signals';
const LS_FOLLOWING = 'signum_following';

function loadShared(): SharedSignal[] {
  try { const raw = localStorage.getItem(LS_SIGNALS); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveShared(s: SharedSignal[]) { try { localStorage.setItem(LS_SIGNALS, JSON.stringify(s)); } catch {} }

function loadFollowing(): string[] {
  try { const raw = localStorage.getItem(LS_FOLLOWING); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function saveFollowing(f: string[]) { try { localStorage.setItem(LS_FOLLOWING, JSON.stringify(f)); } catch {} }

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Generate demo providers and signals
function generateDemoData(): { providers: Provider[]; signals: SharedSignal[] } {
  const providers: Provider[] = [];
  const signals: SharedSignal[] = [];
  const assets = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT'];
  const types: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD'];

  for (let i = 0; i < 10; i++) {
    const addr = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
    const winRate = 40 + Math.random() * 45;
    providers.push({
      address: addr,
      signals: 5 + Math.floor(Math.random() * 50),
      winRate,
      avgReturn: (winRate > 55 ? 1 : -1) * (2 + Math.random() * 15),
      followers: Math.floor(Math.random() * 200),
      following: false,
    });

    // Generate signals per provider
    const numSignals = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < numSignals; j++) {
      const sym = assets[Math.floor(Math.random() * assets.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const price = sym === 'BTC' ? 65000 + Math.random() * 5000 : sym === 'ETH' ? 2400 + Math.random() * 300 : 10 + Math.random() * 200;
      const confidence = 50 + Math.floor(Math.random() * 45);

      signals.push({
        id: `shared-${i}-${j}`,
        symbol: sym,
        assetClass: 'crypto',
        type,
        confidence,
        entry: price,
        sl: type === 'BUY' ? price * 0.95 : price * 1.05,
        tp: type === 'BUY' ? price * 1.1 : price * 0.9,
        rr: 2 + Math.random() * 3,
        technicalScore: 40 + Math.floor(Math.random() * 50),
        fundamentalScore: 30 + Math.floor(Math.random() * 50),
        riskScore: 40 + Math.floor(Math.random() * 40),
        reason: `${type === 'BUY' ? 'Bullish' : type === 'SELL' ? 'Bearish' : 'Neutral'} setup on ${sym} based on technical analysis.`,
        timestamp: Date.now() - Math.random() * 86400000 * 3,
        sharedBy: addr,
        sharedAt: Date.now() - Math.random() * 86400000 * 3,
        likes: Math.floor(Math.random() * 50),
        copies: Math.floor(Math.random() * 20),
        verified: Math.random() > 0.5,
      });
    }
  }

  signals.sort((a, b) => b.sharedAt - a.sharedAt);
  return { providers, signals };
}

type Tab = 'feed' | 'providers' | 'my_signals';

export default function CopyTrading() {
  const [tab, setTab] = useState<Tab>('feed');
  const [following, setFollowing] = useState<string[]>(loadFollowing());
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'BUY' | 'SELL' | 'HOLD'>('all');

  const { providers, signals } = useMemo(() => generateDemoData(), []);

  const toggleFollow = (addr: string) => {
    setFollowing(prev => {
      const next = prev.includes(addr) ? prev.filter(a => a !== addr) : [...prev, addr];
      saveFollowing(next);
      return next;
    });
  };

  const copySignal = (id: string) => {
    setCopied(prev => new Set([...prev, id]));
  };

  const filteredSignals = signals.filter(s => filter === 'all' || s.type === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Users size={15} color="var(--green)" /> Copy Trading
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Follow top traders and copy their signals</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([
          { id: 'feed' as Tab, label: 'Signal Feed', icon: Share2 },
          { id: 'providers' as Tab, label: 'Signal Providers', icon: Users },
          { id: 'my_signals' as Tab, label: 'My Copies', icon: Copy },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6,
            border: `1px solid ${tab === t.id ? 'var(--green)' : 'var(--border)'}`,
            background: tab === t.id ? 'rgba(0,212,170,.08)' : 'transparent',
            color: tab === t.id ? 'var(--green)' : 'var(--text3)', cursor: 'pointer', fontSize: 11,
          }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* SIGNAL FEED */}
      {tab === 'feed' && (
        <>
          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'BUY', 'SELL', 'HOLD'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 10px', borderRadius: 6, border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border)'}`,
                background: filter === f ? 'rgba(59,158,255,.08)' : 'transparent',
                color: filter === f ? 'var(--blue)' : 'var(--text3)', cursor: 'pointer', fontSize: 10,
              }}>{f === 'all' ? 'All Signals' : f}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredSignals.map(s => {
              const up = s.type === 'BUY';
              const hold = s.type === 'HOLD';
              const tc = up ? 'var(--green)' : hold ? 'var(--amber)' : 'var(--red)';
              const Icon = up ? TrendingUp : hold ? Minus : TrendingDown;
              const isCopied = copied.has(s.id);

              return (
                <div key={s.id} style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16,
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {shortAddr(s.sharedBy).slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{shortAddr(s.sharedBy)}</div>
                        <div style={{ fontSize: 9, color: 'var(--text3)' }}>{timeAgo(s.sharedAt)}</div>
                      </div>
                      {s.verified && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, color: 'var(--blue)', padding: '1px 6px', borderRadius: 4, background: 'rgba(59,158,255,.08)' }}>
                          <Check size={8} /> Verified
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6,
                      background: `${tc}11`, border: `1px solid ${tc}33`,
                    }}>
                      <Icon size={12} color={tc} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: tc }}>{s.type}</span>
                    </div>
                  </div>

                  {/* Signal details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700 }}>{s.symbol}</span>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text2)' }}>
                      <span>Entry: <strong style={{ color: 'var(--text)' }}>${formatPrice(s.entry)}</strong></span>
                      <span>SL: <strong style={{ color: 'var(--red)' }}>${formatPrice(s.sl)}</strong></span>
                      <span>TP: <strong style={{ color: 'var(--green)' }}>${formatPrice(s.tp)}</strong></span>
                      <span>R:R <strong style={{ color: 'var(--blue)' }}>{s.rr.toFixed(1)}</strong></span>
                    </div>
                  </div>

                  <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{s.reason}</p>

                  {/* Confidence bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Confidence</span>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
                      <div style={{ width: `${s.confidence}%`, height: '100%', background: tc, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: tc }}>{s.confidence}%</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text3)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Star size={10} /> {s.likes}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Copy size={10} /> {s.copies + (isCopied ? 1 : 0)} copies</span>
                    </div>
                    <button onClick={() => copySignal(s.id)} disabled={isCopied} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6,
                      border: `1px solid ${isCopied ? 'var(--green)' : 'var(--border)'}`,
                      background: isCopied ? 'rgba(0,212,170,.08)' : 'transparent',
                      color: isCopied ? 'var(--green)' : 'var(--text2)', cursor: isCopied ? 'default' : 'pointer', fontSize: 11,
                    }}>
                      {isCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Signal</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* PROVIDERS */}
      {tab === 'providers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {providers.sort((a, b) => b.winRate - a.winRate).map(p => {
            const isFollowing = following.includes(p.address);
            return (
              <div key={p.address} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                background: 'var(--bg2)', border: `1px solid ${isFollowing ? 'rgba(0,212,170,.2)' : 'var(--border)'}`,
                borderRadius: 10,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--bg4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                }}>
                  {p.address.slice(2, 4).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>{shortAddr(p.address)}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                    <span>{p.signals} signals</span>
                    <span style={{ color: p.winRate >= 55 ? 'var(--green)' : 'var(--text3)' }}>{p.winRate.toFixed(0)}% win</span>
                    <span style={{ color: p.avgReturn >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {p.avgReturn >= 0 ? '+' : ''}{p.avgReturn.toFixed(1)}% avg
                    </span>
                    <span><Eye size={9} /> {p.followers + (isFollowing ? 1 : 0)}</span>
                  </div>
                </div>
                <button onClick={() => toggleFollow(p.address)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6,
                  border: `1px solid ${isFollowing ? 'var(--green)' : 'var(--border)'}`,
                  background: isFollowing ? 'rgba(0,212,170,.08)' : 'transparent',
                  color: isFollowing ? 'var(--green)' : 'var(--text2)', cursor: 'pointer', fontSize: 11,
                }}>
                  {isFollowing ? <><Check size={12} /> Following</> : <><Plus size={12} /> Follow</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* MY COPIES */}
      {tab === 'my_signals' && (
        <div>
          {copied.size === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 12 }}>
              No signals copied yet. Browse the <strong>Signal Feed</strong> to find and copy trading signals.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {signals.filter(s => copied.has(s.id)).map(s => {
                const tc = s.type === 'BUY' ? 'var(--green)' : s.type === 'SELL' ? 'var(--red)' : 'var(--amber)';
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: tc,
                      padding: '2px 8px', borderRadius: 4, background: `${tc}11`,
                    }}>{s.type}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{s.symbol}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>@ ${formatPrice(s.entry)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>from {shortAddr(s.sharedBy)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
