import { useState, useEffect, useCallback } from 'react';
import { Activity, BarChart2, Shield, Wallet, Zap, Search, Clock, Wifi, WifiOff, ChevronLeft, ChevronRight, Globe, Bell, Eye, BookOpen, FlaskConical, Calendar, Grid3x3, GitBranch, MessageSquare, Newspaper, TrendingDown, LayoutGrid, ScanSearch, CalendarDays, Fish, Trophy, Gauge, Users } from 'lucide-react';
import TickerBar from './TickerBar';
import Dashboard from './Dashboard';
import ChartPanel from './ChartPanel';
import SignalsPanel from './SignalsPanel';
import RiskCalculator from './RiskCalculator';
import PortfolioTracker from './PortfolioTracker';

import PriceAlerts from './PriceAlerts';
import TradingJournal from './TradingJournal';
import Watchlists from './Watchlists';
import MarketHeatmap from './MarketHeatmap';
import CorrelationMatrix from './CorrelationMatrix';
import Backtesting from './Backtesting';
import EconomicCalendar from './EconomicCalendar';
import AIChat from './AIChat';
import NewsFeed from './NewsFeed';
import DrawdownTracker from './DrawdownTracker';
import Screener from './Screener';
import MultiChart from './MultiChart';
import PnlCalendar from './PnlCalendar';
import WhaleTracker from './WhaleTracker';
import Leaderboard from './Leaderboard';
import FearGreedGauge from './FearGreedGauge';
import CopyTrading from './CopyTrading';

interface AppProps {
  walletAddress?: string;
  walletChain?: 'evm' | 'solana';
}

interface NavSection { label: string; items: { id: string; label: string; icon: any; shortcut?: string }[]; }

const NAV_SECTIONS: NavSection[] = [
  { label: 'OVERVIEW', items: [
    { id: 'dashboard', label: 'Dashboard',    icon: Activity,     shortcut: '1' },
    { id: 'chart',     label: 'Charts',        icon: BarChart2,    shortcut: '2' },
    { id: 'multichart',label: 'Multi-Chart',   icon: LayoutGrid },
    { id: 'screener',  label: 'Screener',      icon: ScanSearch },
    { id: 'heatmap',   label: 'Heatmap',       icon: Grid3x3 },
    { id: 'feargreed', label: 'Fear & Greed',  icon: Gauge },
    { id: 'news',      label: 'News Feed',     icon: Newspaper },
  ]},
  { label: 'ANALYSIS', items: [
    { id: 'signals',     label: 'AI Signals',   icon: Zap,          shortcut: '3' },
    { id: 'chat',        label: 'AI Chat',       icon: MessageSquare },
    { id: 'correlation', label: 'Correlation',   icon: GitBranch },
    { id: 'backtest',    label: 'Backtesting',   icon: FlaskConical },
    { id: 'calendar',    label: 'Calendar',      icon: Calendar },
    { id: 'whale',       label: 'Whale Tracker', icon: Fish },
  ]},
  { label: 'TRADING', items: [
    { id: 'risk',       label: 'Risk Calc',     icon: Shield,       shortcut: '4' },
    { id: 'portfolio',  label: 'Portfolio',      icon: Wallet,       shortcut: '5' },
    { id: 'copytrade',  label: 'Copy Trading',   icon: Users },
    { id: 'alerts',     label: 'Price Alerts',   icon: Bell },
    { id: 'journal',    label: 'Journal',         icon: BookOpen },
    { id: 'pnlcalendar',label: 'P&L Calendar',   icon: CalendarDays },
    { id: 'watchlists', label: 'Watchlists',      icon: Eye },
    { id: 'drawdown',   label: 'Drawdown',        icon: TrendingDown },
    { id: 'leaderboard',label: 'Leaderboard',     icon: Trophy },
  ]},
];

// Flat nav for search and shortcuts
const NAV = NAV_SECTIONS.flatMap(s => s.items);

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const h = time.getHours().toString().padStart(2,'0');
  const m = time.getMinutes().toString().padStart(2,'0');
  const s = time.getSeconds().toString().padStart(2,'0');
  return (
    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text2)', letterSpacing:'.04em' }}>
      <span style={{ color:'var(--text)' }}>{h}:{m}</span>
      <span style={{ opacity:.4 }}>:{s}</span>
      <span style={{ marginLeft:6, fontSize:10, color:'var(--text3)' }}>UTC{time.getTimezoneOffset()<=0?'+':'-'}{Math.abs(time.getTimezoneOffset()/60)}</span>
    </span>
  );
}

function MarketStatus() {
  const now = new Date();
  const utcH = now.getUTCHours();
  const day = now.getUTCDay();
  const nyOpen = utcH >= 14 && utcH < 21 && day >= 1 && day <= 5;
  const londonOpen = utcH >= 8 && utcH < 16 && day >= 1 && day <= 5;
  const tokyoOpen = (utcH >= 0 && utcH < 6) && day >= 1 && day <= 5;
  return (
    <div style={{ display:'flex', gap:8 }}>
      {[
        { label:'Crypto', open:true, color:'var(--green)' },
        { label:'NYSE', open:nyOpen, color:'var(--blue)' },
        { label:'LSE', open:londonOpen, color:'var(--purple)' },
        { label:'TSE', open:tokyoOpen, color:'var(--amber)' },
      ].map(m => (
        <div key={m.label} style={{ display:'flex', alignItems:'center', gap:4 }}>
          <div style={{
            width:5, height:5, borderRadius:'50%',
            background: m.open ? m.color : 'var(--text3)',
            boxShadow: m.open ? `0 0 6px ${m.color}` : 'none',
          }}/>
          <span style={{ fontSize:10, color: m.open ? 'var(--text2)' : 'var(--text3)', fontFamily:'var(--font-mono)' }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function App({ walletAddress = '', walletChain = 'evm' }: AppProps) {
  const [tab, setTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [online, setOnline] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [notifications, setNotifications] = useState<string[]>([
    'Welcome to Open Signum Copilot v1.0',
    'New: Screener, Multi-Chart, Copy Trading, Whale Tracker',
    'New: Leaderboard, Fear & Greed Index, P&L Calendar',
  ]);
  const [showNotifs, setShowNotifs] = useState(false);

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';
  const chainColor = walletChain === 'solana' ? '#14F195' : '#627eea';

  // Online status
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Keyboard shortcuts
  const handleKey = useCallback((e: KeyboardEvent) => {
    // Ctrl+K or Cmd+K = command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setCmdOpen(prev => !prev);
      return;
    }
    // Alt+1..6 = nav
    if (e.altKey && e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      const idx = parseInt(e.key) - 1;
      if (NAV[idx]) setTab(NAV[idx].id);
      return;
    }
    // Escape
    if (e.key === 'Escape') {
      setCmdOpen(false);
      setShowNotifs(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Command palette results
  const cmdResults = cmdQuery.trim()
    ? NAV.filter(n => n.label.toLowerCase().includes(cmdQuery.toLowerCase()))
    : NAV;

  const panels: Record<string, React.ReactNode> = {
    dashboard:   <Dashboard onNav={setTab} />,
    chart:       <ChartPanel />,
    signals:     <SignalsPanel />,
    risk:        <RiskCalculator />,
    portfolio:   <PortfolioTracker />,
    alerts:      <PriceAlerts />,
    journal:     <TradingJournal />,
    watchlists:  <Watchlists />,
    heatmap:     <MarketHeatmap />,
    correlation: <CorrelationMatrix />,
    backtest:    <Backtesting />,
    calendar:    <EconomicCalendar />,
    chat:        <AIChat />,
    news:        <NewsFeed />,
    drawdown:    <DrawdownTracker />,
    screener:    <Screener />,
    multichart:  <MultiChart />,
    pnlcalendar: <PnlCalendar />,
    whale:       <WhaleTracker />,
    leaderboard: <Leaderboard />,
    feargreed:   <FearGreedGauge />,
    copytrade:   <CopyTrading />,
  };

  const currentNav = NAV.find(n => n.id === tab);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {/* ═══ SIDEBAR ═══ */}
      <aside style={{
        width: collapsed ? 56 : 200,
        background:'var(--bg2)', borderRight:'1px solid var(--border)',
        display:'flex', flexDirection:'column', flexShrink:0,
        transition:'width .2s cubic-bezier(.4,0,.2,1)',
        overflow:'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '14px 0' : '14px 16px',
          borderBottom:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          height: 52,
        }}>
          <img src="/logo.png" alt="Open Signum" style={{
            width:28, height:28, borderRadius:6, flexShrink:0,
            objectFit:'contain',
          }} />
          {!collapsed && (
            <div style={{ overflow:'hidden', whiteSpace:'nowrap' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, letterSpacing:'.05em' }}>SIGNUM</div>
              <div style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--font-mono)' }}>v1.0 BETA</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex:1, padding:'4px 6px', display:'flex', flexDirection:'column', gap:0, overflowY:'auto' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              {!collapsed && (
                <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:'var(--text3)', letterSpacing:'.08em', padding:'10px 12px 4px', userSelect:'none' }}>
                  {section.label}
                </div>
              )}
              {collapsed && <div style={{ height:8 }}/>}
              {section.items.map(({ id, label, icon: Icon, shortcut }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    title={collapsed ? `${label}${shortcut ? ` (Alt+${shortcut})` : ''}` : undefined}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding: collapsed ? '8px 0' : '6px 12px',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      borderRadius:6, border:'none', cursor:'pointer',
                      background: active ? 'var(--bg4)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text2)',
                      fontFamily:'var(--font-sans)', fontSize:12, fontWeight: active ? 600 : 400,
                      transition:'all .12s', position:'relative', width:'100%',
                      marginBottom:1,
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget).style.background='var(--bg3)'; (e.currentTarget).style.color='var(--text)'; }}}
                    onMouseLeave={e => { if (!active) { (e.currentTarget).style.background='transparent'; (e.currentTarget).style.color='var(--text2)'; }}}
                  >
                    {active && (
                      <div style={{
                        position:'absolute', left:0, top:'50%', transform:'translateY(-50%)',
                        width:3, height:14, borderRadius:'0 3px 3px 0',
                        background:'var(--green)', boxShadow:'0 0 8px var(--green)',
                      }}/>
                    )}
                    <Icon size={15} style={{ flexShrink:0 }}/>
                    {!collapsed && (
                      <>
                        <span style={{ flex:1, textAlign:'left' }}>{label}</span>
                        {shortcut && (
                          <span style={{
                            fontSize:8, fontFamily:'var(--font-mono)', color:'var(--text3)',
                            background:'var(--bg3)', padding:'1px 4px', borderRadius:3,
                            border:'1px solid var(--border)',
                          }}>{shortcut}</span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div style={{ borderTop:'1px solid var(--border)', padding:'8px 6px' }}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display:'flex', alignItems:'center', gap:8, width:'100%',
              padding: collapsed ? '8px 0' : '8px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius:6, border:'none', cursor:'pointer',
              background:'transparent', color:'var(--text3)', fontSize:12,
            }}
            onMouseEnter={e => (e.currentTarget).style.color='var(--text2)'}
            onMouseLeave={e => (e.currentTarget).style.color='var(--text3)'}
          >
            {collapsed ? <ChevronRight size={14}/> : <><ChevronLeft size={14}/> <span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {/* ─── TOP BAR ─── */}
        <header style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', height:52, borderBottom:'1px solid var(--border)',
          background:'var(--bg2)', flexShrink:0,
        }}>
          {/* Left: breadcrumb + search */}
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {/* Breadcrumb */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {currentNav && (
                <>
                  <currentNav.icon size={14} color="var(--green)"/>
                  <span style={{ fontSize:14, fontWeight:600 }}>{currentNav.label}</span>
                </>
              )}
            </div>
            {/* Search / Command palette trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'5px 12px 5px 10px', borderRadius:6,
                border:'1px solid var(--border)', background:'var(--bg3)',
                cursor:'pointer', color:'var(--text3)', fontSize:12,
                minWidth:200,
              }}
            >
              <Search size={12}/>
              <span style={{ flex:1, textAlign:'left' }}>Search...</span>
              <span style={{
                fontSize:9, fontFamily:'var(--font-mono)', padding:'1px 5px',
                borderRadius:3, background:'var(--bg4)', border:'1px solid var(--border)',
                color:'var(--text3)',
              }}>Ctrl+K</span>
            </button>
          </div>

          {/* Center: market status */}
          <MarketStatus />

          {/* Right: clock, notif, wallet */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <LiveClock />
            {/* Notifications */}
            <div style={{ position:'relative' }}>
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center',
                  width:30, height:30, borderRadius:6,
                  border:'1px solid var(--border)', background:'transparent',
                  cursor:'pointer', color:'var(--text3)', position:'relative',
                }}
              >
                <Bell size={14}/>
                {notifications.length > 0 && (
                  <div style={{
                    position:'absolute', top:-2, right:-2, width:8, height:8,
                    borderRadius:'50%', background:'var(--green)',
                    boxShadow:'0 0 6px var(--green)',
                  }}/>
                )}
              </button>
              {/* Dropdown */}
              {showNotifs && (
                <div style={{
                  position:'absolute', top:'calc(100% + 6px)', right:0,
                  width:280, background:'var(--bg2)', border:'1px solid var(--border)',
                  borderRadius:10, padding:8, zIndex:200,
                  boxShadow:'0 8px 32px rgba(0,0,0,.4)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 8px', marginBottom:4 }}>
                    <span style={{ fontSize:11, fontWeight:600 }}>Notifications</span>
                    <button onClick={() => { setNotifications([]); setShowNotifs(false); }}
                      style={{ background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:10 }}>
                      Clear all
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p style={{ fontSize:11, color:'var(--text3)', padding:'12px 8px', textAlign:'center' }}>No notifications</p>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i} style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'8px', borderRadius:6, fontSize:11, color:'var(--text2)',
                        background: i === 0 ? 'var(--bg3)' : 'transparent',
                      }}>
                        <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--green)', flexShrink:0 }}/>
                        {n}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* Wallet */}
            {shortAddr && (
              <div style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'5px 10px', borderRadius:6,
                background:'var(--bg4)', border:'1px solid var(--border)',
                fontSize:11, fontFamily:'var(--font-mono)', color:'var(--green)',
              }}>
                {walletChain === 'solana' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={chainColor} strokeWidth="2.5"><path d="M4 17h13l3-3H7L4 17Z"/><path d="M4 7h13l3 3H7L4 7Z"/><path d="M4 12h16"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={chainColor} strokeWidth="2"><path d="M12 2L3 12.5L12 17L21 12.5L12 2Z"/><path d="M3 12.5L12 22L21 12.5L12 17L3 12.5Z"/></svg>
                )}
                {shortAddr}
              </div>
            )}
            <a href="/auth/logout" style={{
              fontSize:11, color:'var(--text3)', textDecoration:'none',
              padding:'5px 8px', borderRadius:4,
            }}>Logout</a>
          </div>
        </header>

        {/* ─── TICKER BAR ─── */}
        <TickerBar />

        {/* ─── CONTENT ─── */}
        <main style={{ flex:1, overflow:'auto', padding:'20px 24px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto', width:'100%' }}>
            <div key={tab} className="fade-in">
              {panels[tab] ?? panels.dashboard}
            </div>
          </div>
        </main>

        {/* ─── STATUS BAR ─── */}
        <footer style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 16px', height:26, borderTop:'1px solid var(--border)',
          background:'var(--bg2)', fontSize:10, color:'var(--text3)',
          fontFamily:'var(--font-mono)', flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {/* Connection status */}
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              {online
                ? <><Wifi size={10} color="var(--green)"/><span style={{color:'var(--green)'}}>Connected</span></>
                : <><WifiOff size={10} color="var(--red)"/><span style={{color:'var(--red)'}}>Offline</span></>
              }
            </div>
            <span style={{ color:'var(--border2)' }}>|</span>
            <span>Open Signum Copilot</span>
            <span style={{ color:'var(--border2)' }}>|</span>
            <Globe size={10}/>
            <span>Crypto · Forex · Stocks</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span>AI Engine Active</span>
            <span style={{ color:'var(--border2)' }}>|</span>
            <span>Open Signum Copilot v1.0</span>
          </div>
        </footer>
      </div>

      {/* ═══ COMMAND PALETTE ═══ */}
      {cmdOpen && (
        <div
          style={{
            position:'fixed', inset:0, zIndex:9999,
            background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'flex-start', justifyContent:'center',
            paddingTop:120,
          }}
          onClick={() => setCmdOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:480, background:'var(--bg2)', border:'1px solid var(--border)',
              borderRadius:12, overflow:'hidden',
              boxShadow:'0 20px 60px rgba(0,0,0,.5)',
            }}
          >
            {/* Search input */}
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
              <Search size={16} color="var(--text3)"/>
              <input
                autoFocus
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                placeholder="Search pages, actions..."
                style={{
                  flex:1, background:'transparent', border:'none', outline:'none',
                  color:'var(--text)', fontSize:14, fontFamily:'var(--font-sans)',
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && cmdResults.length > 0) {
                    setTab(cmdResults[0].id);
                    setCmdOpen(false);
                    setCmdQuery('');
                  }
                }}
              />
              <button
                onClick={() => setCmdOpen(false)}
                style={{
                  background:'var(--bg4)', border:'1px solid var(--border)',
                  borderRadius:4, padding:'2px 6px', cursor:'pointer',
                  color:'var(--text3)', fontSize:10, fontFamily:'var(--font-mono)',
                }}>
                ESC
              </button>
            </div>
            {/* Results */}
            <div style={{ padding:6, maxHeight:300, overflow:'auto' }}>
              {cmdResults.map(({ id, label, icon: Icon, shortcut }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setCmdOpen(false); setCmdQuery(''); }}
                  style={{
                    display:'flex', alignItems:'center', gap:10, width:'100%',
                    padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer',
                    background: tab === id ? 'var(--bg4)' : 'transparent',
                    color:'var(--text)', fontSize:13, fontFamily:'var(--font-sans)',
                    textAlign:'left',
                  }}
                  onMouseEnter={e => (e.currentTarget).style.background='var(--bg3)'}
                  onMouseLeave={e => (e.currentTarget).style.background = tab === id ? 'var(--bg4)' : 'transparent'}
                >
                  <Icon size={16} color="var(--text2)"/>
                  <span style={{ flex:1 }}>{label}</span>
                  <span style={{
                    fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text3)',
                    background:'var(--bg3)', padding:'2px 6px', borderRadius:3,
                    border:'1px solid var(--border)',
                  }}>Alt+{shortcut}</span>
                </button>
              ))}
              {cmdResults.length === 0 && (
                <p style={{ padding:'20px', textAlign:'center', fontSize:13, color:'var(--text3)' }}>
                  No results for "{cmdQuery}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
