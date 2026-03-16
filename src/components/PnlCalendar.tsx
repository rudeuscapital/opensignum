import { useState, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

interface Trade {
  id: string; symbol: string; side: 'LONG' | 'SHORT';
  entryPrice: number; exitPrice: number; amount: number;
  entryDate: string; exitDate: string; notes: string;
}

const LS_KEY = 'signum_journal';
function loadTrades(): Trade[] {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

export default function PnlCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const trades = useMemo(() => loadTrades(), []);

  // Compute daily PnL from closed trades
  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => {
      if (!t.exitDate) return;
      const date = t.exitDate.split('T')[0];
      const pnl = t.side === 'LONG'
        ? (t.exitPrice - t.entryPrice) * t.amount
        : (t.entryPrice - t.exitPrice) * t.amount;
      map.set(date, (map.get(date) || 0) + pnl);
    });
    return map;
  }, [trades]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  // Month stats
  const monthPnls: number[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const pnl = dailyPnl.get(key);
    if (pnl !== undefined) monthPnls.push(pnl);
  }
  const totalPnl = monthPnls.reduce((s, v) => s + v, 0);
  const winDays = monthPnls.filter(p => p > 0).length;
  const lossDays = monthPnls.filter(p => p < 0).length;
  const bestDay = monthPnls.length > 0 ? Math.max(...monthPnls) : 0;
  const worstDay = monthPnls.length > 0 ? Math.min(...monthPnls) : 0;

  // Find max absolute PnL for color scaling
  const maxAbsPnl = Math.max(...Array.from(dailyPnl.values()).map(Math.abs), 1);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const monthName = new Date(year, month).toLocaleString('en', { month: 'long' });

  const cellColor = (pnl: number): string => {
    const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);
    if (pnl > 0) return `rgba(0, 212, 170, ${0.1 + intensity * 0.5})`;
    if (pnl < 0) return `rgba(255, 77, 106, ${0.1 + intensity * 0.5})`;
    return 'transparent';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <CalendarDays size={15} color="var(--green)" /> P&L Calendar
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Daily profit & loss from your trading journal</p>
      </div>

      {/* Month stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { l: 'Month P&L', v: `$${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`, c: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
          { l: 'Win Days', v: winDays.toString(), c: 'var(--green)' },
          { l: 'Loss Days', v: lossDays.toString(), c: 'var(--red)' },
          { l: 'Best Day', v: `$${bestDay >= 0 ? '+' : ''}${bestDay.toFixed(2)}`, c: 'var(--green)' },
          { l: 'Worst Day', v: `$${worstDay.toFixed(2)}`, c: 'var(--red)' },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text2)', cursor: 'pointer' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
            {monthName} {year}
          </span>
          <button onClick={nextMonth} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text2)', cursor: 'pointer' }}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: 6 }} />
          ))}
          {/* Actual days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const pnl = dailyPnl.get(key);
            const today = new Date();
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            return (
              <div key={day} style={{
                aspectRatio: '1', borderRadius: 6, padding: 4,
                background: pnl !== undefined ? cellColor(pnl) : 'var(--bg3)',
                border: isToday ? '2px solid var(--blue)' : '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: pnl !== undefined ? 'default' : 'default',
                transition: 'transform .15s',
              }} title={pnl !== undefined ? `$${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}` : 'No trades'}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--blue)' : 'var(--text2)' }}>
                  {day}
                </div>
                {pnl !== undefined && (
                  <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: pnl >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: 2 }}>
                    {pnl >= 0 ? '+' : ''}{pnl.toFixed(0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(255,77,106,.4)' }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Loss</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--bg3)', border: '1px solid var(--border)' }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>No trades</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(0,212,170,.4)' }} />
            <span style={{ fontSize: 10, color: 'var(--text3)' }}>Profit</span>
          </div>
        </div>
      </div>

      {trades.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 12 }}>
          No trades in your journal yet. Add trades in the <strong>Journal</strong> tab to see P&L data here.
        </div>
      )}
    </div>
  );
}
