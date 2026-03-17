'use client';
import { useEffect, useMemo, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type GeneratedDocument } from '../../lib/api';
import styles from './page.module.css';

const PAGE_SIZE = 20;

export default function DocumentsPage() {
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('generate weekly digest');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [shareMinutes, setShareMinutes] = useState(60);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadDocuments = () => {
    return api.documents().then((items) => {
      setDocs(items);
      if (items.length > 0 && (!selected || !items.some((d) => d.name === selected))) {
        setSelected(items[0].name);
      }
    });
  };

  useEffect(() => {
    reloadDocuments()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) {
      setContent('');
      return;
    }
    api.document(selected)
      .then((doc) => setContent(doc.content))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load document'));
  }, [selected]);

  const onGenerate = async () => {
    const query = prompt.trim();
    if (!query) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await api.generateDocument(query);
      await reloadDocuments();

      const outputPath = typeof response.metadata?.['outputPath'] === 'string' ? response.metadata['outputPath'] : null;
      if (outputPath) {
        const fileName = outputPath.split(/[/\\]/).pop() ?? null;
        if (fileName) setSelected(fileName);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const onShare = async () => {
    if (!selected) return;
    setSharing(true);
    setError(null);
    try {
      const data = await api.shareDocument(selected, shareMinutes);
      setShareUrl(api.documentShareUrl(data.sharePath));
      setShareExpiresAt(data.expiresAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create share link');
    } finally {
      setSharing(false);
    }
  };

  const onCopyShare = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  };

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => `${d.name} ${d.preview.join(' ')}`.toLowerCase().includes(q));
  }, [docs, query]);

  const visibleDocs = filteredDocs.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredDocs.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.heading}>Documents</h1>
          <p className={styles.sub}>Generated outputs from agent document workflows.</p>
          <div className={styles.generateRow}>
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className={styles.input}
              placeholder="generate weekly digest"
              aria-label="Document generation prompt"
            />
            <button className={styles.button} onClick={onGenerate} disabled={generating} aria-label="Generate document">
              {generating ? 'Generating...' : 'Generate'}
            </button>
            {selected && (
              <a className={styles.exportLink} href={api.documentDownloadUrl(selected)} aria-label="Export selected document">
                Export
              </a>
            )}
          </div>

          <div className={styles.searchRow}>
            <input
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents..."
              aria-label="Search documents"
            />
          </div>

          <div className={styles.shareRow}>
            <label className={styles.shareLabel}>
              Share expiry
              <select
                className={styles.shareSelect}
                value={shareMinutes}
                onChange={(e) => setShareMinutes(Number.parseInt(e.target.value, 10))}
                aria-label="Share link expiry"
              >
                <option value={15}>15 min</option>
                <option value={60}>1 hour</option>
                <option value={240}>4 hours</option>
                <option value={1440}>24 hours</option>
                <option value={10080}>7 days</option>
              </select>
            </label>
            <button className={styles.shareButton} onClick={onShare} disabled={!selected || sharing} aria-label="Create expiring share link">
              {sharing ? 'Creating...' : 'Create share link'}
            </button>
            {shareUrl && (
              <button className={styles.copyButton} onClick={onCopyShare} aria-label="Copy share link">
                Copy link
              </button>
            )}
          </div>

          {shareUrl && shareExpiresAt && (
            <p className={styles.shareMeta}>
              {shareUrl} (expires {new Date(shareExpiresAt).toLocaleString()})
            </p>
          )}
        </header>

        {loading && <p className={styles.muted}>Loading...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && docs.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No generated documents yet</p>
            <p className={styles.muted}>Run a document query, for example: <code>vrrbose ask "generate weekly digest"</code></p>
          </div>
        )}

        {!loading && docs.length > 0 && (
          <div className={styles.grid}>
            <aside className={styles.list}>
              {visibleDocs.map((doc) => (
                <button
                  key={doc.name}
                  className={`${styles.item} ${selected === doc.name ? styles.itemActive : ''}`}
                  onClick={() => setSelected(doc.name)}
                  aria-pressed={selected === doc.name}
                  aria-label={`Preview document ${doc.name}`}
                >
                  <div className={styles.itemName}>{doc.name}</div>
                  <div className={styles.itemMeta}>{new Date(doc.updatedAt).toLocaleString()}</div>
                  {doc.preview.map((line, idx) => (
                    <div key={`${doc.name}-${idx}`} className={styles.itemPreview}>{line}</div>
                  ))}
                </button>
              ))}
            </aside>
            <section className={styles.viewer}>
              <pre className={styles.content}>{content || 'Select a document to preview.'}</pre>
            </section>
          </div>
        )}

        {!loading && !error && canLoadMore && (
          <div className={styles.moreWrap}>
            <button className={styles.moreBtn} onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
              Load more
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
