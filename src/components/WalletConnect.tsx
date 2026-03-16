import { useState } from 'react';
import { BrowserProvider } from 'ethers';
import { SiweMessage } from 'siwe';
import { Wallet, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';

// Clear all user data on fresh login
function clearUserData() {
  const keys = ['signum_portfolio', 'signum_alerts', 'signum_journal', 'signum_watchlists'];
  keys.forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

type Chain = 'evm' | 'solana';
type Status = 'idle' | 'connecting' | 'signing' | 'verifying' | 'success' | 'error';

interface WalletOption {
  id: string;
  name: string;
  chain: Chain;
  icon: string; // SVG path data
  color: string;
  detect: () => boolean;
}

const WALLETS: WalletOption[] = [
  {
    id: 'metamask', name: 'MetaMask', chain: 'evm',
    icon: 'M20.5 3.5L12.5 9.5L14 6L20.5 3.5Z M3.5 3.5L11 9.6L10 6L3.5 3.5Z M17.5 16.5L15.5 19.5L20 20.7L21 16.6L17.5 16.5Z M3 16.6L4 20.7L8.5 19.5L6.5 16.5L3 16.6Z',
    color: '#E2761B',
    detect: () => !!(window as any).ethereum?.isMetaMask,
  },
  {
    id: 'coinbase', name: 'Coinbase Wallet', chain: 'evm',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z',
    color: '#0052FF',
    detect: () => !!(window as any).ethereum?.isCoinbaseWallet || !!(window as any).coinbaseWalletExtension,
  },
  {
    id: 'phantom-sol', name: 'Phantom', chain: 'solana',
    icon: 'M4 12a8 8 0 0116 0 8 8 0 01-16 0zm4-1a1 1 0 100-2 1 1 0 000 2zm4 0a1 1 0 100-2 1 1 0 000 2zm4 0a1 1 0 100-2 1 1 0 000 2z',
    color: '#AB9FF2',
    detect: () => !!(window as any).phantom?.solana?.isPhantom,
  },
  {
    id: 'solflare', name: 'Solflare', chain: 'solana',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    color: '#FC822B',
    detect: () => !!(window as any).solflare?.isSolflare,
  },
  {
    id: 'backpack', name: 'Backpack', chain: 'solana',
    icon: 'M20 8H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2v-8a2 2 0 00-2-2zM8 6V4a2 2 0 012-2h4a2 2 0 012 2v2',
    color: '#E33E3F',
    detect: () => !!(window as any).backpack?.isBackpack,
  },
  {
    id: 'evm-generic', name: 'Other EVM Wallet', chain: 'evm',
    icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 007 0',
    color: '#7a92a8',
    detect: () => !!(window as any).ethereum,
  },
  {
    id: 'solana-generic', name: 'Other Solana Wallet', chain: 'solana',
    icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 007 0',
    color: '#14F195',
    detect: () => !!(window as any).solana,
  },
];

// ── Get the Solana provider for a given wallet ID ───────────────────────────
function getSolanaProvider(walletId: string): any {
  const w = window as any;
  if (walletId === 'phantom-sol') return w.phantom?.solana;
  if (walletId === 'solflare') return w.solflare;
  if (walletId === 'backpack') return w.backpack;
  return w.phantom?.solana || w.solflare || w.solana;
}

export default function WalletConnect() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [chainTab, setChainTab] = useState<Chain>('evm');

  // ── EVM connect flow ────────────────────────────────────────────────────
  const connectEvm = async (walletId: string) => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) {
        throw new Error('No EVM wallet detected. Please install MetaMask or another EVM wallet.');
      }

      setStatus('connecting');
      setError('');

      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setStatus('signing');
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const { nonce } = await nonceRes.json();

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Open Signum Copilot',
        uri: window.location.origin,
        version: '1',
        chainId: Number(network.chainId),
        nonce,
      });

      const messageStr = message.prepareMessage();
      const signature = await signer.signMessage(messageStr);

      setStatus('verifying');
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageStr, signature, chain: 'evm' }),
      });

      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.error || 'Verification failed');

      clearUserData();
      setStatus('success');
      setTimeout(() => { window.location.href = '/app'; }, 500);
    } catch (err: any) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError('Signature rejected. Please try again.');
      } else {
        setError(err.message || 'Connection failed');
      }
      setStatus('error');
    }
  };

  // ── Solana connect flow ─────────────────────────────────────────────────
  const connectSolana = async (walletId: string) => {
    try {
      const provider = getSolanaProvider(walletId);
      if (!provider) {
        throw new Error(`${walletId === 'phantom-sol' ? 'Phantom' : 'Solana'} wallet not detected. Please install it.`);
      }

      setStatus('connecting');
      setError('');

      const resp = await provider.connect();
      const publicKey = resp.publicKey || provider.publicKey;
      const address = publicKey.toString();

      // Request nonce
      setStatus('signing');
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const { nonce } = await nonceRes.json();

      // Build the sign-in message
      const message = [
        `Open Signum Copilot wants you to sign in with your Solana account:`,
        address,
        '',
        'Sign in to Open Signum Copilot',
        '',
        `URI: ${window.location.origin}`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join('\n');

      const encoded = new TextEncoder().encode(message);
      const signResult = await provider.signMessage(encoded, 'utf8');
      // Phantom returns { signature: Uint8Array }, Solflare returns Uint8Array
      const sigBytes: Uint8Array = signResult.signature || signResult;
      const signatureBase64 = btoa(String.fromCharCode(...sigBytes));

      // Verify on server
      setStatus('verifying');
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature: signatureBase64, address, chain: 'solana' }),
      });

      const result = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(result.error || 'Verification failed');

      clearUserData();
      setStatus('success');
      setTimeout(() => { window.location.href = '/app'; }, 500);
    } catch (err: any) {
      if (err.code === 4001 || err.message?.includes('User rejected')) {
        setError('Signature rejected. Please try again.');
      } else {
        setError(err.message || 'Connection failed');
      }
      setStatus('error');
    }
  };

  const handleConnect = (wallet: WalletOption) => {
    if (wallet.chain === 'solana') connectSolana(wallet.id);
    else connectEvm(wallet.id);
  };

  const isLoading = ['connecting', 'signing', 'verifying'].includes(status);

  const statusMessages: Record<Status, string> = {
    idle: '',
    connecting: 'Connecting to wallet...',
    signing: 'Please sign the message in your wallet...',
    verifying: 'Verifying signature...',
    success: 'Authenticated! Redirecting...',
    error: '',
  };

  const filteredWallets = WALLETS.filter(w => w.chain === chainTab);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
    background: active ? 'var(--bg4)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text3)',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 420 }}>
      {/* Chain tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 10,
        background: 'var(--bg3)', border: '1px solid var(--border)',
      }}>
        <button onClick={() => { setChainTab('evm'); setError(''); setStatus('idle'); }} style={tabStyle(chainTab === 'evm')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chainTab === 'evm' ? '#627eea' : 'var(--text3)'} strokeWidth="2"><path d="M12 2L3 12.5L12 17L21 12.5L12 2Z"/><path d="M3 12.5L12 22L21 12.5L12 17L3 12.5Z"/></svg>
            Ethereum
          </span>
        </button>
        <button onClick={() => { setChainTab('solana'); setError(''); setStatus('idle'); }} style={tabStyle(chainTab === 'solana')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={chainTab === 'solana' ? '#14F195' : 'var(--text3)'} strokeWidth="2"><path d="M4 17h13l3-3H7L4 17Z"/><path d="M4 7h13l3 3H7L4 7Z"/><path d="M4 12h16"/></svg>
            Solana
          </span>
        </button>
      </div>

      {/* Wallet list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        {filteredWallets.map(wallet => (
          <button
            key={wallet.id}
            onClick={() => handleConnect(wallet)}
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 10, width: '100%',
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)', cursor: isLoading ? 'wait' : 'pointer',
              fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              if (!isLoading) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = wallet.color;
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg3)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg2)';
            }}
          >
            {/* Wallet icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `${wallet.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={wallet.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={wallet.icon} />
              </svg>
            </div>

            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{wallet.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                {wallet.chain === 'evm' ? 'Ethereum / EVM' : 'Solana'}
              </div>
            </div>

            {/* Status / detect badge */}
            {status === 'idle' && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                padding: '2px 8px', borderRadius: 4,
                color: 'var(--text3)', background: 'var(--bg4)',
              }}>
                Connect
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Status / loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--green)' }} />
          <p style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--font-mono)', margin: 0 }}>
            {statusMessages[status]}
          </p>
        </div>
      )}

      {status === 'success' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={16} color="var(--green)" />
          <p style={{ fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-mono)', margin: 0 }}>
            Authenticated! Redirecting...
          </p>
        </div>
      )}

      {status === 'error' && error && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 16px', borderRadius: 8, width: '100%',
          background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.25)',
        }}>
          <AlertTriangle size={14} color="var(--red)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
