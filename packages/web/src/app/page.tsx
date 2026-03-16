'use client';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

import { Mail, FolderOpen, GitBranch, Webhook, Hash } from 'lucide-react';
import {
  SiNotion, SiObsidian,
  SiGithubcopilot, SiAnthropic, SiCursor,
} from '@icons-pack/react-simple-icons';

const DESTINATIONS = [
  { name: 'Notion',      teal: false, icon: <SiNotion size={18} /> },
  { name: 'Slack',       teal: false, icon: <Hash size={18} /> },
  { name: 'Obsidian',    teal: false, icon: <SiObsidian size={18} /> },
  { name: 'Email',       teal: false, icon: <Mail size={18} /> },
  { name: 'Filesystem',  teal: false, icon: <FolderOpen size={18} /> },
  { name: 'Git',         teal: false, icon: <GitBranch size={18} /> },
  { name: 'Webhook',     teal: false, icon: <Webhook size={18} /> },
  { name: 'Claude Code', teal: true,  icon: <SiAnthropic size={18} /> },
  { name: 'Cursor',      teal: true,  icon: <SiCursor size={18} /> },
  { name: 'Copilot',     teal: true,  icon: <SiGithubcopilot size={18} /> },
];

function DestinationsCarousel() {
  // Duplicate 3× so the loop never shows a gap
  const row1 = [...DESTINATIONS, ...DESTINATIONS, ...DESTINATIONS];
  const row2 = [...DESTINATIONS, ...DESTINATIONS, ...DESTINATIONS];

  return (
    <div className={styles.carouselWrap}>
      {/* Row 1 — scrolls left */}
      <div className={styles.carouselRow}>
        <div className={styles.carouselTrack}>
          {row1.map((d, i) => (
            <div key={i} className={`${styles.carouselItem} ${d.teal ? styles.carouselItemTeal : ''}`}>
              <span className={styles.carouselIcon}>{d.icon}</span>
              <span className={styles.carouselName}>{d.name}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Row 2 — scrolls right */}
      <div className={styles.carouselRow}>
        <div className={`${styles.carouselTrack} ${styles.carouselTrackReverse}`}>
          {row2.map((d, i) => (
            <div key={i} className={`${styles.carouselItem} ${d.teal ? styles.carouselItemTeal : ''}`}>
              <span className={styles.carouselIcon}>{d.icon}</span>
              <span className={styles.carouselName}>{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll('[data-reveal]')
    ) as HTMLElement[];

    els.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.65s ease, transform 0.65s ease';
    });

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = parseInt(el.dataset.delay ?? '0');
            setTimeout(() => {
              el.style.opacity = '1';
              el.style.transform = 'none';
            }, delay);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.06, rootMargin: '0px 0px -32px 0px' }
    );

    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>

      {/* ── NAV ── */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <div className={styles.logo}>
            <span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.logoDot}>.</span>dev
          </div>
          <ul className={styles.navLinks}>
            <li><a href="#features">Features</a></li>
            <li><a href="#how">How it works</a></li>
            <li><a href="https://github.com/vrrbose/vrrbose">GitHub</a></li>
            <li><a href="/dashboard" className={styles.navCta}>Dashboard →</a></li>
          </ul>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={styles.hero}>
        {/* Animated background */}
        <div className={styles.heroBg} aria-hidden>
          <div className={styles.orb1} />
          <div className={styles.orb2} />
          <div className={styles.orb3} />
          <div className={styles.gridLines} />
          <div className={styles.scanline} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.eyebrow} data-reveal data-delay="0">
            <span className={styles.eyebrowDot} />
            Local-first &nbsp;·&nbsp; Privacy by default
          </div>
          <h1 className={styles.heroHeadline} data-reveal data-delay="80">
            Your codebase has a <em>memory</em> now.
          </h1>
          <p className={styles.heroSub} data-reveal data-delay="180">
            Vrrbose watches every session, commit, and decision as you build.
            Ask it anything. It was there.
          </p>
          <div className={styles.ctaRow} data-reveal data-delay="280">
            <a href="#install" className={styles.btnPrimary}>Install Vrrbose</a>
            <a href="#features" className={styles.btnGhost}>See how it works</a>
          </div>
          <p className={styles.installNote} data-reveal data-delay="380">
            npm install -g vrrbose &nbsp;·&nbsp; vrrbose init &nbsp;·&nbsp; free for local use
          </p>
        </div>

        <div className={styles.heroScroll} aria-hidden>
          <span className={styles.heroScrollLine} />
        </div>
      </section>

      <div className={styles.wrap}>

        {/* ── TWO WAYS IN ── */}
        <section data-reveal>
          <div className={styles.label}>Two ways in</div>
          <p className={styles.sectionDesc}>
            The CLI is the fastest path for quick queries and document generation.
            The web UI is where the visual layer lives — session replays, diff views,
            charts, the full agent interface. Both talk to the same data.
          </p>
          <div className={styles.accessGrid}>
            <div className={styles.accessCard}>
              <div className={styles.accessName}>CLI</div>
              <div className={styles.accessDesc}>
                Ask questions, generate documents, trigger replays from the terminal.{' '}
                <code>vrrbose ask</code> to start.
              </div>
            </div>
            <div className={styles.accessCard}>
              <div className={styles.accessName}>Web UI</div>
              <div className={styles.accessDesc}>
                Session replays, diff views, charts, and the full agent interface.
                At <code>localhost:7331/ui</code> locally or{' '}
                <code>app.vrrbose.dev</code> with a cloud account.
              </div>
            </div>
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── WHAT IT DOES ── */}
        <section id="features">
          <div className={styles.label} data-reveal>What it does</div>
          <div className={styles.bigFeatures}>
            <div className={styles.bigFeature} data-reveal data-delay="0">
              <div className={styles.bigFeatureTag}>Session replay</div>
              <h2 className={styles.bigFeatureTitle}>Watch how any feature was built.</h2>
              <p className={styles.bigFeatureBody}>
                Every coding session becomes a chapter-by-chapter replay of what changed
                and why — the AI prompts that drove decisions, the commits that landed
                them, the tests that confirmed them. Not a diff viewer. The actual story.
              </p>
            </div>
            <div className={styles.bigFeature} data-reveal data-delay="60">
              <div className={styles.bigFeatureTag}>Archivist agent</div>
              <h2 className={styles.bigFeatureTitle}>Ask it what it saw.</h2>
              <p className={styles.bigFeatureBody}>
                The Vrrbose agent has been watching your project since day one. Ask it
                anything about your own work history — what you shipped last month, why
                a file keeps changing, which decisions have already been made — and it
                answers with the full context, not a guess.
              </p>
            </div>
            <div className={styles.bigFeature} data-reveal data-delay="120">
              <div className={styles.bigFeatureTag}>AI pair memory</div>
              <h2 className={styles.bigFeatureTitle}>Your AI tools stop starting from scratch.</h2>
              <p className={styles.bigFeatureBody}>
                Vrrbose feeds your full project history to Claude Code, Cursor, and
                Copilot as they work — unstable files, recent decisions, open TODOs,
                new dependencies. Every AI pair has context it would have taken
                weeks to absorb on its own.
              </p>
            </div>
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── HOW IT WORKS ── */}
        <section id="how">
          <div className={styles.label} data-reveal>How it works</div>
          <div className={styles.steps}>
            {[
              {
                n: '01',
                title: 'Install once, works everywhere',
                body: (
                  <><code>vrrbose init</code> installs global git hooks and the IDE
                  extension. Every project you open is tracked from that point.</>
                ),
              },
              {
                n: '02',
                title: 'It captures everything passively',
                body: 'Commits, file edits, terminal commands, test runs, branch switches, AI prompt sessions — logged to a local buffer as you work.',
              },
              {
                n: '03',
                title: 'Ask it things or open the web UI',
                body: (
                  <><code>vrrbose ask</code> for quick answers from the terminal.
                  Open <code>localhost:7331/ui</code> for session replays, charts,
                  and the full agent.</>
                ),
              },
              {
                n: '04',
                title: "Publish to wherever it's useful",
                body: 'Session summaries to Notion. Digests to Slack. Living docs auto-committed to the repo. Brag sheets and performance reviews on demand.',
              },
            ].map((s, i) => (
              <div key={s.n} className={styles.step} data-reveal data-delay={String(i * 55)}>
                <span className={styles.stepNum}>{s.n}</span>
                <div>
                  <div className={styles.stepTitle}>{s.title}</div>
                  <p className={styles.stepBody}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── CLI DEMO ── */}
        <section data-reveal>
          <div className={styles.label}>From the terminal</div>
          <div className={styles.cliBlock}>
            <span className={styles.cliComment}># after a two-hour session</span>
            <br />
            <span className={styles.cliPrompt}>$ </span>
            <span className={styles.cliCmd}>vrrbose ask &quot;what did I just build&quot;</span>
            <br /><br />
            <span className={styles.cliOut}>You spent 2h 14m on feat/compass. 6 commits,</span><br />
            <span className={styles.cliOut}>3 files changed. Added the Compass plan builder</span><br />
            <span className={styles.cliOut}>to the onboarding flow. Open TODO: &quot;revisit</span><br />
            <span className={styles.cliOut}>loading state when API is slow.&quot;</span>
            <br /><br />
            <span className={styles.cliPrompt}>$ </span>
            <span className={styles.cliCmd}>vrrbose ask &quot;write my Q1 brag sheet&quot;</span>
            <br /><br />
            <span className={styles.cliOut}>Saved: ~/.vrrbose/output/2026-Q1_brag_sheet.md</span>
            <span className={styles.cliCursor} />
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── EVERYTHING IT TRACKS ── */}
        <section data-reveal>
          <div className={styles.label}>Everything it tracks</div>
          <div className={styles.featGrid}>
            {[
              { name: 'Git events', desc: 'Commits, staged diffs, merges, branch switches, PRs — global hooks, zero per-project setup.' },
              { name: 'IDE activity', desc: 'File edits, new files, deletions, test runs, terminal commands. VS Code first, JetBrains in progress.' },
              { name: 'AI prompt sessions', desc: 'In Cursor, logs what prompted each change and which tools ran.' },
              { name: 'Time capsules', desc: 'Periodic snapshots of architecture, decisions, and open TODOs.' },
              { name: 'Living README', desc: 'Queues documentation updates as you build. You review, then it commits.' },
              { name: 'Decision log', desc: <><code>docs/decisions/</code> entries surfaced at session end. One click to commit.</> },
            ].map((f, i) => (
              <div key={f.name} className={styles.featCard} data-reveal data-delay={String((i % 3) * 55)}>
                <div className={styles.featName}>{f.name}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── WHAT IT WRITES ── */}
        <section data-reveal>
          <div className={styles.label}>What it can write for you</div>
          <p className={styles.sectionDescSm}>
            The same event log. Different audiences. Generated from your own history,
            not templates filled with guesses.
          </p>
          <div className={styles.outputGrid}>
            {[
              { name: 'Session summary', desc: 'What you built in the last few hours. In your journal before you close the laptop.' },
              { name: 'Weekly digest', desc: 'Commits, features, active days. A readable account for you or your team.' },
              { name: 'Brag sheet', desc: 'Achievement-framed, based on what actually shipped.' },
              { name: 'Performance review', desc: "Impact-focused, structured for a manager. Use your company's template." },
              { name: 'CV bullets', desc: 'Action verb + metric, pulled from real delivery data.' },
              { name: 'Investor update', desc: "Shipped, metrics, what's next. For founders who are also the engineer." },
            ].map((f, i) => (
              <div key={f.name} className={styles.featCard} data-reveal data-delay={String((i % 2) * 70)}>
                <div className={styles.featName}>{f.name}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ── WHERE OUTPUTS GO ── */}
        <section data-reveal>
          <div className={styles.label}>Where outputs go</div>
          <p className={styles.sectionDescSm}>Route each output type to its own destination.</p>
          <DestinationsCarousel />
        </section>

        <hr className={styles.divider} />

        {/* ── FINAL CTA ── */}
        <section className={styles.finalCta} data-reveal id="install">
          <h2 className={styles.finalTitle}>Start watching your projects.</h2>
          <p className={styles.finalSub}>
            One install. Works on every project you already have.
            Free, local, no account needed to start.
          </p>
          <div className={styles.ctaRow}>
            <a
              href="https://www.npmjs.com/package/vrrbose"
              className={styles.btnPrimary}
              target="_blank"
              rel="noopener noreferrer"
            >
              Install Vrrbose
            </a>
            <a
              href="https://github.com/vrrbose/vrrbose"
              className={styles.btnGhost}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
          <p className={styles.installNote}>npm install -g vrrbose &nbsp;·&nbsp; vrrbose init</p>
        </section>

      </div>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.logoDot}>.</span>dev
          </div>
          <ul className={styles.footerLinks}>
            <li><a href="#">Docs</a></li>
            <li><a href="#">Privacy</a></li>
            <li><a href="https://github.com/vrrbose/vrrbose">GitHub</a></li>
            <li><a href="#">X</a></li>
          </ul>
        </div>
      </footer>

    </div>
  );
}
