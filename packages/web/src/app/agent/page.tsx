'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type ProjectStatus } from '../../lib/api';
import styles from './page.module.css';

interface Message { role: 'user' | 'assistant'; content: string; queryType?: string; streaming?: boolean; }

const SUGGESTIONS = [
  'What did I work on this week?',
  'Summarise the last session',
  'What files have I touched most?',
  'Write my brag sheet',
];

function AgentContent() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ProjectStatus[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api.projects().then(ps => {
      setProjects(ps);
      if (ps.length > 0 && !projectId) setProjectId(ps[0].projectId);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Fire pre-filled query from dashboard ?q= param
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !firedRef.current) {
      firedRef.current = true;
      submit(q);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(query: string) {
    if (!query.trim() || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setInput('');
    setLoading(true);

    // Add placeholder assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    cancelRef.current = api.askStream(
      query,
      projectId || undefined,
      (chunk) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      },
      (queryType) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, streaming: false, queryType };
          return next;
        });
        setLoading(false);
      },
      (_err) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: 'Could not reach the daemon. Is `vrrbose start` running?', streaming: false };
          return next;
        });
        setLoading(false);
      },
    );
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
          {projects.length > 1 && (
            <div className={styles.projectRow}>
              <select
                className={styles.projectSelect}
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                disabled={loading}
              >
                {projects.map(p => (
                  <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.inputRow}>
            <textarea className={styles.input} placeholder="Ask anything about your project..."
              value={input} onChange={e => setInput(e.target.value)} rows={2} disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(input); } }} />
            <button className={styles.sendBtn} onClick={() => submit(input)} disabled={loading || !input.trim()}>
              {loading ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>}>
      <AgentContent />
    </Suspense>
  );
}
