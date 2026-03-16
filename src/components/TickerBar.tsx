import { useEffect, useState } from 'react';
import type { Ticker } from '../lib/api';
import { fetchMultipleCryptoTickers as fetchMultipleTickers, formatPrice } from '../lib/api';

const SYMBOLS = ['BTC','ETH','SOL','BNB','ADA','DOGE','XRP','AVAX'];

export default function TickerBar() {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  useEffect(() => {
    const load = async () => {
      try { setTickers(await fetchMultipleTickers(SYMBOLS)); } catch {}
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  if (!tickers.length) return (
    <div style={{ height: 32, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }} />
  );

  const items = [...tickers, ...tickers]; // duplicate for seamless loop

  return (
    <div style={{
      height: 32, background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
      overflow: 'hidden', display: 'flex', alignItems: 'center',
    }}>
      <div style={{
        display: 'flex', gap: 0,
        animation: 'tickerScroll 40s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {items.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 20px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>
              {t.symbol}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)' }}>
              ${formatPrice(t.price)}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: t.changePct24h >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {t.changePct24h >= 0 ? '+' : ''}{t.changePct24h.toFixed(2)}%
            </span>
            <span style={{ color: 'var(--border2)', fontSize: 10 }}>|</span>
          </span>
        ))}
      </div>
    </div>
  );
}
