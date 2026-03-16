import { useState } from 'react';
import { Calendar, AlertTriangle, TrendingUp, Clock, Globe } from 'lucide-react';

interface EconEvent {
  date: string;
  time: string;
  name: string;
  country: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
  category: string;
}

// Static calendar of recurring major economic events
// In production, this would come from an API like TradingEconomics
function getUpcomingEvents(): EconEvent[] {
  const now = new Date();
  const events: EconEvent[] = [];

  // Generate recurring events for the next 14 days
  for (let d = 0; d < 14; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const day = date.getDay();
    const dateStr = date.toISOString().split('T')[0];
    const weekOfMonth = Math.ceil(date.getDate() / 7);

    // Skip weekends
    if (day === 0 || day === 6) continue;

    // Monday events
    if (day === 1) {
      events.push({ date: dateStr, time: '08:30', name: 'Manufacturing PMI', country: 'US', impact: 'medium', category: 'Manufacturing', forecast: '51.2', previous: '50.8' });
    }
    // Tuesday events
    if (day === 2) {
      events.push({ date: dateStr, time: '10:00', name: 'Consumer Confidence', country: 'US', impact: 'medium', category: 'Consumer', forecast: '104.5', previous: '103.1' });
    }
    // Wednesday events
    if (day === 3) {
      events.push({ date: dateStr, time: '14:00', name: 'FOMC Minutes / Rate Decision', country: 'US', impact: 'high', category: 'Central Bank', forecast: '5.50%', previous: '5.50%' });
      events.push({ date: dateStr, time: '08:15', name: 'ADP Employment Change', country: 'US', impact: 'high', category: 'Employment', forecast: '180K', previous: '164K' });
    }
    // Thursday events
    if (day === 4) {
      events.push({ date: dateStr, time: '08:30', name: 'Initial Jobless Claims', country: 'US', impact: 'medium', category: 'Employment', forecast: '215K', previous: '211K' });
      events.push({ date: dateStr, time: '08:30', name: 'GDP Growth Rate (QoQ)', country: 'US', impact: 'high', category: 'GDP', forecast: '2.8%', previous: '3.2%' });
    }
    // Friday events
    if (day === 5) {
      // First Friday = NFP
      if (weekOfMonth === 1) {
        events.push({ date: dateStr, time: '08:30', name: 'Non-Farm Payrolls (NFP)', country: 'US', impact: 'high', category: 'Employment', forecast: '200K', previous: '227K' });
        events.push({ date: dateStr, time: '08:30', name: 'Unemployment Rate', country: 'US', impact: 'high', category: 'Employment', forecast: '4.2%', previous: '4.2%' });
      }
      // Second Friday = CPI (usually)
      if (weekOfMonth === 2) {
        events.push({ date: dateStr, time: '08:30', name: 'CPI (YoY)', country: 'US', impact: 'high', category: 'Inflation', forecast: '2.7%', previous: '2.6%' });
        events.push({ date: dateStr, time: '08:30', name: 'Core CPI (MoM)', country: 'US', impact: 'high', category: 'Inflation', forecast: '0.3%', previous: '0.3%' });
      }
    }

    // EU events
    if (day === 4 && weekOfMonth === 2) {
      events.push({ date: dateStr, time: '07:45', name: 'ECB Interest Rate Decision', country: 'EU', impact: 'high', category: 'Central Bank', forecast: '4.50%', previous: '4.50%' });
    }

    // Crypto-specific events
    if (day === 1 && weekOfMonth === 1) {
      events.push({ date: dateStr, time: 'All Day', name: 'CME Bitcoin Futures Expiry', country: 'Global', impact: 'medium', category: 'Crypto' });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export default function EconomicCalendar() {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all');
  const events = getUpcomingEvents();
  const filtered = filter === 'all' ? events : events.filter(e => e.impact === filter);

  const impactColor: Record<string, string> = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--text3)' };
  const countryFlag: Record<string, string> = { US: '🇺🇸', EU: '🇪🇺', UK: '🇬🇧', JP: '🇯🇵', Global: '🌐' };

  // Group by date
  const grouped: Record<string, EconEvent[]> = {};
  filtered.forEach(e => { (grouped[e.date] ??= []).push(e); });

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Calendar size={15} color="var(--amber)" /> Economic Calendar
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>Key economic events that impact markets — next 14 days</p>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['all', 'high', 'medium'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            borderColor: filter === f ? 'var(--amber)' : 'var(--border)',
            background: filter === f ? 'rgba(245,166,35,0.1)' : 'transparent',
            color: filter === f ? 'var(--amber)' : 'var(--text2)',
          }}>{f === 'all' ? `All (${events.length})` : f === 'high' ? 'High Impact' : 'Medium Impact'}</button>
        ))}
      </div>

      {/* Events by date */}
      {Object.entries(grouped).map(([date, dayEvents]) => {
        const isToday = date === today;
        const dateObj = new Date(date + 'T00:00:00');
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        return (
          <div key={date}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '4px 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
                color: isToday ? 'var(--green)' : 'var(--text)',
              }}>
                {dayName}, {monthDay}
              </span>
              {isToday && (
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,212,170,0.1)', color: 'var(--green)', fontWeight: 600 }}>
                  TODAY
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dayEvents.map((e, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderLeft: `3px solid ${impactColor[e.impact]}`,
                  borderRadius: 6,
                }}>
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{countryFlag[e.country] ?? '🌐'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: 50 }}>
                    <Clock size={10} color="var(--text3)" />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text3)' }}>{e.time}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{e.name}</div>
                    <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{e.category}</span>
                  </div>
                  <span style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 3, fontWeight: 600, fontFamily: 'var(--font-mono)',
                    background: `${impactColor[e.impact]}18`, color: impactColor[e.impact],
                  }}>{e.impact.toUpperCase()}</span>
                  {e.forecast && (
                    <div style={{ textAlign: 'right', minWidth: 60 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Forecast</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{e.forecast}</div>
                    </div>
                  )}
                  {e.previous && (
                    <div style={{ textAlign: 'right', minWidth: 60 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Previous</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>{e.previous}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
