import { useState } from 'react';
import { Activity, BarChart2, Shield, Wallet, Settings, Zap } from 'lucide-react';

interface Props {
  active?: string;
  onNav?: (tab: string) => void;
  walletAddress?: string;
  walletChain?: 'evm' | 'solana';
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'chart',     label: 'Chart',     icon: BarChart2 },
  { id: 'signals',   label: 'Signals',   icon: Zap },
  { id: 'risk',      label: 'Risk Calc', icon: Shield },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
];

export default function Navbar({ active = 'dashboard', onNav, walletAddress, walletChain = 'evm' }: Props) {
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';
  const chainColor = walletChain === 'solana' ? '#14F195' : '#627eea';
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: '52px',
      background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/logo.png" alt="Open Signum" style={{
          width: 28, height: 28, borderRadius: 6, objectFit: 'contain',
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
          SIGNUM
        </span>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          background: 'var(--bg4)', border: '1px solid var(--border2)',
          color: 'var(--green)', padding: '2px 6px', borderRadius: 4,
        }}>BETA</span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 2 }}>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNav?.(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              background: active === id ? 'var(--bg4)' : 'transparent',
              color: active === id ? 'var(--text)' : 'var(--text2)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (active !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { if (active !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)'; }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {shortAddr && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 6,
            background: 'var(--bg4)', border: '1px solid var(--border)',
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)',
          }}>
            {/* Chain icon */}
            {walletChain === 'solana' ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={chainColor} strokeWidth="2.5"><path d="M4 17h13l3-3H7L4 17Z"/><path d="M4 7h13l3 3H7L4 7Z"/><path d="M4 12h16"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={chainColor} strokeWidth="2"><path d="M12 2L3 12.5L12 17L21 12.5L12 2Z"/><path d="M3 12.5L12 22L21 12.5L12 17L3 12.5Z"/></svg>
            )}
            {shortAddr}
          </div>
        )}
        <button
          onClick={() => onNav?.('settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 13,
          }}
        >
          <Settings size={13} />
          Settings
        </button>
        {shortAddr && (
          <a
            href="/auth/logout"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text3)', cursor: 'pointer',
              fontSize: 12, textDecoration: 'none',
            }}
          >
            Logout
          </a>
        )}
      </div>
    </nav>
  );
}
