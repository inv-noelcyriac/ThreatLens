const CalendarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const WrenchIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* Hover border accent — per severity */
const SEVERITY_ACCENT = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

/* Severity block tokens resolved via CSS variables — theme-aware */
const SEV_VARS = {
  CRITICAL: { bg: 'var(--sev-critical-bg)', color: 'var(--sev-critical-text)' },
  HIGH: { bg: 'var(--sev-high-bg)', color: 'var(--sev-high-text)' },
  MEDIUM: { bg: 'var(--sev-medium-bg)', color: 'var(--sev-medium-text)' },
  LOW: { bg: 'var(--sev-low-bg)', color: 'var(--sev-low-text)' },
};

/* Small pill badge — list view only */
function SeverityBadge({ severity, cvss }) {
  return (
    <span className={`badge-${severity.toLowerCase()} text-[0.68rem] font-bold tracking-[0.05em] px-2.5 py-[3px] rounded-[5px] uppercase whitespace-nowrap flex-shrink-0`}>
      {severity} · {cvss}
    </span>
  );
}

/** Wraps matched portions of text in <mark className="highlight-match"> */
function HighlightText({ text, query }) {
  if (!query || !text) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="highlight-match">{part}</mark>
          : part
      )}
    </>
  );
}

/* ── Card view (grid) — matches design spec ── */
function CardView({ vuln, onClick, activeQuery }) {
  const accent = SEVERITY_ACCENT[vuln.severity] || '#9e9e9e';
  const sev = SEV_VARS[vuln.severity] || { bg: 'var(--bg-badge)', color: 'var(--text-secondary)' };

  return (
    <article
      className="vuln-card rounded-[12px] border cursor-pointer flex flex-col transition-all duration-200 outline-none"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-card)',
        boxShadow: 'var(--shadow-sm)',
        padding: '10px 16px',
      }}
      onMouseEnter={e => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = isDark
          ? `0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px ${accent}55`
          : 'var(--shadow-md)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-card)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
      onClick={() => onClick(vuln)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => e.key === 'Enter' && onClick(vuln)}
      aria-label={`View details for ${vuln.title}`}
    >
      {/* Header: ecosystem pill */}
      <div className="mb-1">
        <span
          className="vuln-card-badge text-[0.72rem] px-[10px] py-[3px] rounded-[6px]"
          style={{
            background: 'var(--bg-badge)',
            color: 'var(--text-secondary)',
            fontWeight: 400,
          }}
        >
          {vuln.ecosystem} ecosystem
        </span>
      </div>

      {/* Title + CVE ID */}
      <div className="mb-2" style={{ minHeight: '4rem' }}>
        <h2
          className="text-[0.9875rem] leading-snug mb-0.5 transition-colors duration-150 line-clamp-2"
          style={{ color: 'var(--text-heading)', fontWeight: 500 }}
        >
          <HighlightText text={vuln.title} query={activeQuery} />
        </h2>
        <p
          className="text-[0.75rem]"
          style={{
            color: 'var(--text-muted)',
            fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
            fontWeight: 400,
          }}
        >
          <HighlightText text={vuln.id} query={activeQuery} />
        </p>
      </div>

      {/* Severity + CVSS stat blocks */}
      <div className="flex gap-[8px] mb-2">
        {/* Severity — flex:1, colored bg */}
        <div
          className="flex-1 px-[10px] py-1 rounded-[6px] flex flex-col gap-[2px]"
          style={{ background: sev.bg }}
        >
          <span
            className="text-[0.6875rem] uppercase tracking-[0.06em]"
            style={{ color: 'var(--text-secondary)', fontWeight: 400 }}
          >
            severity
          </span>
          <span
            className="text-[0.875rem] lowercase"
            style={{ color: sev.color, fontWeight: 500 }}
          >
            {vuln.severity.toLowerCase()}
          </span>
        </div>

        {/* CVSS — compact, neutral bg */}
        <div
          className="vuln-card-badge px-[10px] py-1 rounded-[6px] flex flex-col gap-[2px] min-w-[58px]"
          style={{ background: 'var(--bg-badge)' }}
        >
          <span
            className="text-[0.6875rem] uppercase tracking-[0.06em]"
            style={{ color: 'var(--text-secondary)', fontWeight: 400 }}
          >
            cvss
          </span>
          <span
            className="text-[0.875rem]"
            style={{ color: 'var(--text-primary)', fontWeight: 500 }}
          >
            {vuln.cvss}
          </span>
        </div>
      </div>

      {/* Remediation — separated by hairline */}
      {vuln.remediation && (
        <div className="pt-1.5 mb-2" style={{ borderTop: '1px solid var(--border-card)' }}>
          <p
            className="text-[0.7rem] mb-0.5"
            style={{ color: 'var(--text-secondary)', fontWeight: 400 }}
          >
            remediation
          </p>
          <div className="flex items-center gap-1.5" style={{ color: 'var(--accent-blue)' }}>
            <span className="flex-shrink-0"><WrenchIcon /></span>
            <p className="text-[0.8375rem]" style={{ fontWeight: 400 }}>
              <HighlightText text={vuln.remediation} query={activeQuery} />
            </p>
          </div>
        </div>
      )}

      {/* Footer: source + date */}
      <div
        className="flex items-center justify-between text-[0.75rem]"
        style={{ color: 'var(--text-muted)', fontWeight: 400 }}
      >
        <span>source: {vuln.source}</span>
        <span className="flex items-center gap-1.5">
          <CalendarIcon />
          {vuln.date}
        </span>
      </div>
    </article>
  );
}

/* ── List view (row) ── */
function ListView({ vuln, onClick, activeQuery }) {
  const accent = SEVERITY_ACCENT[vuln.severity] || '#9e9e9e';
  return (
    <article
      className="flex items-center gap-3 px-5 py-3.5 rounded-[12px] border cursor-pointer transition-all duration-[160ms] outline-none"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-card)',
        boxShadow: 'var(--shadow-sm)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.transform = 'translateX(3px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-card)';
        e.currentTarget.style.transform = 'translateX(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
      onClick={() => onClick(vuln)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => e.key === 'Enter' && onClick(vuln)}
      aria-label={`View details for ${vuln.title}`}
    >
      <SeverityBadge severity={vuln.severity} cvss={vuln.cvss} />
      <span
        className="text-[0.78rem] font-semibold tracking-[0.01em] w-[148px] flex-shrink-0 hidden sm:block"
        style={{ color: 'var(--text-muted)', fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace" }}
      >
        <HighlightText text={vuln.id} query={activeQuery} />
      </span>
      <h2 className="flex-1 text-[0.9rem] font-medium leading-snug min-w-0" style={{ color: 'var(--text-primary)' }}>
        <span className="block truncate">
          <HighlightText text={vuln.title} query={activeQuery} />
        </span>
      </h2>
      <span
        className="text-[0.8rem] font-medium flex-shrink-0 hidden md:block px-2.5 py-1 rounded-[5px] border"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-badge)', borderColor: 'var(--border-card)' }}
      >
        {vuln.ecosystem}
      </span>
      <span className="text-[0.78rem] flex-shrink-0 hidden lg:flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <CalendarIcon />
        {vuln.date}
      </span>
      <span className="flex-shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>
        <ChevronRightIcon />
      </span>
    </article>
  );
}

/* ── Export ── */
export default function VulnCard({ vuln, onClick, activeQuery, viewMode }) {
  if (viewMode === 'list') {
    return <ListView vuln={vuln} onClick={onClick} activeQuery={activeQuery} />;
  }
  return <CardView vuln={vuln} onClick={onClick} activeQuery={activeQuery} />;
}
