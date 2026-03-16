import { useState, useEffect } from 'react';
import { Newspaper, RefreshCw, ExternalLink, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface NewsItem {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  category: string;
}

// Fetch crypto news from CoinGecko status/trending + simulated feed
async function fetchNews(): Promise<NewsItem[]> {
  const news: NewsItem[] = [];

  try {
    // CoinGecko trending coins — indicates market interest
    const r = await fetch('https://api.coingecko.com/api/v3/search/trending');
    if (r.ok) {
      const data = await r.json();
      const coins = data.coins?.slice(0, 5) ?? [];
      coins.forEach((c: any, i: number) => {
        const coin = c.item;
        const priceChange = coin.data?.price_change_percentage_24h?.usd ?? 0;
        news.push({
          title: `${coin.name} (${coin.symbol.toUpperCase()}) is trending`,
          description: `Ranked #${coin.market_cap_rank ?? 'N/A'} by market cap. 24h change: ${priceChange.toFixed(2)}%. Currently at $${coin.data?.price?.toFixed(coin.data.price > 1 ? 2 : 6) ?? 'N/A'}.`,
          url: `https://www.coingecko.com/en/coins/${coin.id}`,
          source: 'Trending',
          publishedAt: new Date().toISOString(),
          sentiment: priceChange > 0 ? 'bullish' : priceChange < 0 ? 'bearish' : 'neutral',
          category: 'Trending',
        });
      });
    }
  } catch {}

  try {
    // CoinGecko global data for market overview news
    const r = await fetch('https://api.coingecko.com/api/v3/global');
    if (r.ok) {
      const data = await r.json();
      const d = data.data;
      const mcapChange = d.market_cap_change_percentage_24h_usd;
      news.push({
        title: `Global crypto market cap ${mcapChange >= 0 ? 'rises' : 'drops'} ${Math.abs(mcapChange).toFixed(2)}% in 24h`,
        description: `Total market cap: $${(d.total_market_cap.usd / 1e12).toFixed(2)}T. BTC dominance: ${d.market_cap_percentage.btc.toFixed(1)}%. Active coins: ${d.active_cryptocurrencies.toLocaleString()}.`,
        url: 'https://www.coingecko.com/',
        source: 'Market Overview',
        publishedAt: new Date().toISOString(),
        sentiment: mcapChange >= 0 ? 'bullish' : 'bearish',
        category: 'Market',
      });
    }
  } catch {}

  return news;
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish'>('all');

  const refresh = async () => {
    setLoading(true);
    const items = await fetchNews();
    setNews(items);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = filter === 'all' ? news : news.filter(n => n.sentiment === filter);

  const sentimentColor = { bullish: 'var(--green)', bearish: 'var(--red)', neutral: 'var(--text3)' };
  const sentimentIcon = { bullish: TrendingUp, bearish: TrendingDown, neutral: Clock };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Newspaper size={15} color="var(--amber)" /> News Feed
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text3)' }}>Market news and trending assets</p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)',
          cursor: loading ? 'wait' : 'pointer', fontSize: 11,
        }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Refresh
        </button>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['all', 'bullish', 'bearish'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600,
            borderColor: filter === f ? 'var(--amber)' : 'var(--border)',
            background: filter === f ? 'rgba(245,166,35,0.1)' : 'transparent',
            color: filter === f ? 'var(--amber)' : 'var(--text2)',
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* News items */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
              <div style={{ width: '70%', height: 16, borderRadius: 4, background: 'var(--bg3)', animation: 'pulse 1.5s infinite', marginBottom: 8 }} />
              <div style={{ width: '100%', height: 12, borderRadius: 4, background: 'var(--bg3)', animation: 'pulse 1.5s infinite', marginBottom: 4 }} />
              <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'var(--bg3)', animation: 'pulse 1.5s infinite' }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text3)', fontSize: 12 }}>
          No news available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item, i) => {
            const SIcon = sentimentIcon[item.sentiment];
            return (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', textDecoration: 'none',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderLeft: `3px solid ${sentimentColor[item.sentiment]}`,
                borderRadius: 8, padding: '12px 14px', transition: 'border-color .15s',
              }}
                onMouseEnter={e => (e.currentTarget).style.borderColor = 'var(--border2)'}
                onMouseLeave={e => (e.currentTarget).style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: sentimentColor[item.sentiment],
                    padding: '2px 6px', borderRadius: 3,
                    background: `${sentimentColor[item.sentiment]}15`,
                  }}>
                    <SIcon size={10} /> {item.sentiment.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: 3, background: 'var(--bg4)' }}>
                    {item.category}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>{item.source}</span>
                  <ExternalLink size={10} color="var(--text3)" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6 }}>{item.description}</div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
