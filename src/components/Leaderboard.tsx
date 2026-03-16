import { useState, useEffect } from 'react';
import { Trophy, Medal, TrendingUp, TrendingDown, Target, Flame, Crown } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName: string;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  streak: number;
  badge: string;
  score: number;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function generateLeaderboard(): LeaderboardEntry[] {
  // Generate realistic leaderboard data
  const entries: LeaderboardEntry[] = [];
  const badges = ['Whale', 'Diamond Hands', 'Scalper', 'Swing King', 'DeFi Degen', 'Chart Master', 'Signal Pro', 'Risk Manager'];

  for (let i = 0; i < 25; i++) {
    const winRate = 45 + Math.random() * 40;
    const totalTrades = 20 + Math.floor(Math.random() * 200);
    const avgPnlPerTrade = (winRate > 55 ? 1 : -1) * (50 + Math.random() * 500);
    const totalPnl = avgPnlPerTrade * totalTrades * (0.3 + Math.random() * 0.7);
    const streak = Math.floor(Math.random() * 12);

    entries.push({
      rank: 0,
      address: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      displayName: '',
      totalPnl,
      winRate,
      totalTrades,
      streak,
      badge: badges[Math.floor(Math.random() * badges.length)],
      score: totalPnl * (winRate / 100) * Math.log(totalTrades + 1),
    });
  }

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

type Tab = 'pnl' | 'winrate' | 'trades';

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<Tab>('pnl');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Simulate loading
    setTimeout(() => {
      setEntries(generateLeaderboard());
      setLoading(false);
    }, 500);
  }, []);

  const sorted = [...entries].sort((a, b) => {
    if (tab === 'pnl') return b.totalPnl - a.totalPnl;
    if (tab === 'winrate') return b.winRate - a.winRate;
    return b.totalTrades - a.totalTrades;
  }).map((e, i) => ({ ...e, rank: i + 1 }));

  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  const rankColor = (r: number) => r === 1 ? '#FFD700' : r === 2 ? '#C0C0C0' : r === 3 ? '#CD7F32' : 'var(--text3)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Trophy size={15} color="var(--amber)" /> Leaderboard
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Top traders ranked by performance</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {([
          { id: 'pnl' as Tab, label: 'Top P&L', icon: TrendingUp },
          { id: 'winrate' as Tab, label: 'Win Rate', icon: Target },
          { id: 'trades' as Tab, label: 'Most Active', icon: Flame },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 6,
            border: `1px solid ${tab === t.id ? 'var(--amber)' : 'var(--border)'}`,
            background: tab === t.id ? 'rgba(245,166,35,.08)' : 'transparent',
            color: tab === t.id ? 'var(--amber)' : 'var(--text3)', cursor: 'pointer', fontSize: 11, fontWeight: 500,
          }}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading leaderboard...</div>
      ) : (
        <>
          {/* Top 3 podium */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[top3[1], top3[0], top3[2]].filter(Boolean).map((e, i) => {
              const isFirst = i === 1;
              return (
                <div key={e.address} style={{
                  background: 'var(--bg2)', border: `1px solid ${isFirst ? 'rgba(255,215,0,.3)' : 'var(--border)'}`,
                  borderRadius: 12, padding: isFirst ? '20px 14px' : '16px 14px',
                  textAlign: 'center', marginTop: isFirst ? 0 : 16,
                  boxShadow: isFirst ? '0 0 20px rgba(255,215,0,.05)' : 'none',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>
                    {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : '🥉'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {shortAddr(e.address)}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: isFirst ? 20 : 16, fontWeight: 700,
                    color: e.totalPnl >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: 6,
                  }}>
                    {e.totalPnl >= 0 ? '+' : ''}${Math.abs(e.totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 10, color: 'var(--text3)' }}>
                    <span>{e.winRate.toFixed(0)}% win</span>
                    <span>{e.totalTrades} trades</span>
                  </div>
                  <div style={{
                    display: 'inline-block', marginTop: 8, fontSize: 9, fontFamily: 'var(--font-mono)',
                    padding: '2px 8px', borderRadius: 4, background: 'var(--bg4)', color: 'var(--amber)',
                  }}>{e.badge}</div>
                </div>
              );
            })}
          </div>

          {/* Rest of the list */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '6%' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '24%' }}>Trader</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '20%' }}>P&L</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '15%' }}>Win Rate</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '12%' }}>Trades</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '10%' }}>Streak</th>
                  <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 10, color: 'var(--text3)', fontWeight: 500, width: '13%' }}>Badge</th>
                </tr>
              </thead>
              <tbody>
                {rest.map(e => (
                  <tr key={e.address} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: rankColor(e.rank), fontWeight: 700 }}>
                      {e.rank}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      {shortAddr(e.address)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: e.totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {e.totalPnl >= 0 ? '+' : ''}${Math.abs(e.totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <div style={{ width: 40, height: 4, background: 'var(--bg4)', borderRadius: 2 }}>
                          <div style={{ width: `${e.winRate}%`, height: '100%', borderRadius: 2, background: e.winRate >= 55 ? 'var(--green)' : e.winRate >= 45 ? 'var(--amber)' : 'var(--red)' }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: e.winRate >= 55 ? 'var(--green)' : 'var(--text2)' }}>
                          {e.winRate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                      {e.totalTrades}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: e.streak >= 5 ? 'var(--amber)' : 'var(--text3)' }}>
                      {e.streak > 0 ? `🔥${e.streak}` : '-'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg4)', color: 'var(--text3)' }}>
                        {e.badge}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
