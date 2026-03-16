import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Trash2, Bot, User } from 'lucide-react';

interface Message { role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'What is RSI and how to use it?',
  'Explain support and resistance levels',
  'How does position sizing work?',
  'What moves crypto markets?',
  'Explain the risk/reward ratio',
  'What is a stop loss strategy?',
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || loading) return;

    const userMsg: Message = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.slice(-10) }), // Last 10 messages for context
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 400 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <MessageSquare size={15} color="var(--green)" /> AI Trading Assistant
        </h2>
        <p style={{ fontSize: 11, color: 'var(--text3)' }}>
          AI-powered assistant · Ask about markets, strategies, and analysis
        </p>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '0 4px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Bot size={36} color="var(--text3)" style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center' }}>
              Ask me anything about trading, markets, or strategies
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 500 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: 11,
                  transition: 'all .15s',
                }}
                  onMouseEnter={e => { (e.currentTarget).style.borderColor = 'var(--green)'; (e.currentTarget).style.color = 'var(--green)'; }}
                  onMouseLeave={e => { (e.currentTarget).style.borderColor = 'var(--border)'; (e.currentTarget).style.color = 'var(--text2)'; }}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: msg.role === 'user' ? 'var(--bg4)' : 'rgba(0,212,170,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {msg.role === 'user' ? <User size={14} color="var(--text2)" /> : <Bot size={14} color="var(--green)" />}
            </div>
            <div style={{
              maxWidth: '70%', padding: '10px 14px', borderRadius: 10,
              background: msg.role === 'user' ? 'var(--bg4)' : 'var(--bg2)',
              border: `1px solid ${msg.role === 'user' ? 'var(--border2)' : 'var(--border)'}`,
              fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: 'rgba(0,212,170,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="var(--green)" />
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Loader2 size={14} color="var(--green)" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,77,106,0.08)', border: '1px solid rgba(255,77,106,0.2)', color: 'var(--red)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} style={{
            padding: '8px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text3)', cursor: 'pointer',
          }} title="Clear chat">
            <Trash2 size={14} />
          </button>
        )}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Ask about trading, markets, strategies..."
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg2)',
            color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 8,
          border: '1px solid var(--green)', background: 'rgba(0,212,170,0.1)',
          color: 'var(--green)', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
          opacity: !input.trim() || loading ? 0.5 : 1,
        }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
