'use client';
import { useState, useRef, useEffect } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api } from '../../lib/api';
import styles from './page.module.css';

interface Message { role: 'user' | 'assistant'; content: string; queryType?: string; }

const SUGGESTIONS = [
  'What did I work on this week?',
  'Summarise the last session',
  'What files have I touched most?',
  'Write my brag sheet',
];

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function submit(query: string) {
    if (!query.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.ask(query);
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer, queryType: res.queryType }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach the daemon. Is `vrrbose start` running?' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <div className={styles.chat}>
        <div className={styles.thread}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyHeading}>Ask about your project</h2>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <button key={s} className={styles.pill} onClick={() => submit(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={`${styles.message} ${styles[m.role]}`}>
                  {m.role === 'assistant' && m.queryType && (
                    <span className={styles.queryType}>{m.queryType}</span>
                  )}
                  <pre className={styles.content}>{m.content}</pre>
                </div>
              ))}
              {loading && (
                <div className={`${styles.message} ${styles.assistant} ${styles.skeleton}`}>
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonLine} style={{ width: '70%' }} />
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>
        <div className={styles.inputArea}>
          <div className={styles.inputRow}>
            <textarea className={styles.input} placeholder="Ask anything about your project..."
              value={input} onChange={e => setInput(e.target.value)} rows={2} disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); } }} />
            <button className={styles.sendBtn} onClick={() => submit(input)} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
