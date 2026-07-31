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

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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
  CRITICAL: { bg: 'var(--sev-critical-bg)', color: 'var(--sev-critical-text)', border: 'var(--sev-critical-border)' },
  HIGH: { bg: 'var(--sev-high-bg)', color: 'var(--sev-high-text)', border: 'var(--sev-high-border)' },
  MEDIUM: { bg: 'var(--sev-medium-bg)', color: 'var(--sev-medium-text)', border: 'var(--sev-medium-border)' },
  LOW: { bg: 'var(--sev-low-bg)', color: 'var(--sev-low-text)', border: 'var(--sev-low-border)' },
};

/* Small pill badge — list view only */
function SeverityBadge({ severity, cvss }) {
  const key = (severity || 'MEDIUM').toUpperCase();
  const accent = SEVERITY_ACCENT[key] || '#9e9e9e';
  return (
    <span className={`badge-${key.toLowerCase()} text-[0.72rem] font-extrabold tracking-[0.05em] px-3 py-1 rounded-[6px] uppercase whitespace-nowrap flex-shrink-0 flex items-center gap-1.5`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent, boxShadow: `0 0 5px ${accent}` }} />
      {key} · {cvss}
    </span>
  );
}

/** Wraps matched portions of text in <mark className="highlight-match"> */
function HighlightText({ text, query }) {
  if (text === null || text === undefined) return null;
  let strText = typeof text === 'string' ? text : String(text);
  if (!query || !strText) return <>{strText}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = strText.split(new RegExp(`(${escaped})`, 'gi'));
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
function CardView({ vuln, onClick, activeQuery, isAdmin, onEdit }) {
  if (!vuln) return null;
  const severityKey = (vuln.severity || 'MEDIUM').toUpperCase();
  const accent = SEVERITY_ACCENT[severityKey] || '#9e9e9e';
  const sev = SEV_VARS[severityKey] || { bg: 'var(--bg-badge)', color: 'var(--text-secondary)' };

  return (
    <article
      className="vuln-card rounded-[12px] border cursor-pointer flex flex-col transition-all duration-200 outline-none relative"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-card)',
        boxShadow: 'var(--shadow-sm)',
        padding: '12px 16px',
      }}
      onMouseEnter={e => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        e.currentTarget.style.borderColor = isDark ? `${accent}88` : accent;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = isDark
          ? `0 12px 32px rgba(0,0,0,0.6), 0 0 10px -2px ${accent}22`
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
      aria-label={`View details for ${vuln.title || 'Vulnerability'}`}
    >
      {/* Header: ecosystem pill */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className="vuln-card-badge text-[0.72rem] px-[10px] py-[3px] rounded-[6px] truncate max-w-[220px] inline-block align-middle"
          style={{
            background: 'var(--bg-badge)',
            color: 'var(--text-secondary)',
            fontWeight: 400,
          }}
          title={vuln.ecosystem ? `${vuln.ecosystem} ecosystem` : undefined}
        >
          {vuln.ecosystem || 'Security'} ecosystem
        </span>
      </div>

      {/* CVE ID Heading + Description */}
      <div className="mb-2" style={{ minHeight: '3.8rem' }}>
        <h2
          className="text-[1.05rem] leading-snug mb-1 transition-colors duration-150 truncate"
          style={{
            color: 'var(--text-heading)',
            fontWeight: 700,
            fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
          }}
          title={vuln.id}
        >
          <HighlightText text={vuln.id || 'N/A'} query={activeQuery} />
        </h2>
        <p
          className="text-[0.8rem] leading-snug line-clamp-2"
          style={{
            color: 'var(--text-secondary)',
            fontWeight: 400,
          }}
          title={vuln.description || vuln.title}
        >
          <HighlightText text={vuln.description || vuln.title || 'Security Advisory'} query={activeQuery} />
        </p>
      </div>

      {/* Severity + CVSS stat blocks */}
      <div className="flex gap-[8px] mb-2">
        {/* Severity — flex:1, colored bg block */}
        <div
          className="flex-1 px-3 py-1.5 rounded-[8px] flex flex-col gap-[2px] min-w-0"
          style={{
            background: sev.bg,
            border: sev.border && sev.border !== 'transparent' ? `1px solid ${sev.border}` : '1px solid transparent',
          }}
        >
          <span
            className="text-[0.6875rem] uppercase tracking-[0.06em] font-semibold truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            severity
          </span>
          <span
            className="text-[0.875rem] font-bold uppercase tracking-[0.03em] truncate"
            style={{ color: sev.color }}
          >
            {severityKey}
          </span>
        </div>

        {/* CVSS — compact, neutral bg */}
        <div
          className="vuln-card-badge px-3 py-1.5 rounded-[8px] flex flex-col gap-[2px] min-w-[62px] border"
          style={{ background: 'var(--bg-badge)', borderColor: 'var(--border-card)' }}
        >
          <span
            className="text-[0.6875rem] uppercase tracking-[0.06em] truncate"
            style={{ color: 'var(--text-secondary)', fontWeight: 400 }}
          >
            cvss
          </span>
          <span
            className="text-[0.875rem] font-bold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {vuln.cvss ?? 'N/A'}
          </span>
        </div>
      </div>

      {/* Remediation — separated by hairline */}
      {vuln.remediation && (
        <div className="pt-1.5 mb-2" style={{ borderTop: '1px solid var(--border-card)' }}>
          <p
            className="text-[0.7rem] mb-0.5 truncate"
            style={{ color: 'var(--text-secondary)', fontWeight: 400 }}
          >
            remediation
          </p>
          <div className="flex items-center gap-1.5 min-w-0" style={{ color: 'var(--accent-blue)' }}>
            <span className="flex-shrink-0"><WrenchIcon /></span>
            <p className="text-[0.8375rem] line-clamp-2" style={{ fontWeight: 400 }} title={typeof vuln.remediation === 'string' ? vuln.remediation : undefined}>
              <HighlightText text={vuln.remediation} query={activeQuery} />
            </p>
          </div>
        </div>
      )}

      {/* Footer: source + date */}
      <div
        className="flex items-center justify-between text-[0.75rem] gap-2 mt-auto"
        style={{ color: 'var(--text-muted)', fontWeight: 400 }}
      >
        <span className="truncate max-w-[160px]" title={vuln.source}>source: {vuln.source || 'ThreatLens'}</span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          <CalendarIcon />
          {vuln.date || 'N/A'}
        </span>
      </div>
    </article>
  );
}

/* ── List view (row) ── */
function ListView({ vuln, onClick, activeQuery, isAdmin, onEdit }) {
  if (!vuln) return null;
  const severityKey = (vuln.severity || 'MEDIUM').toUpperCase();
  const accent = SEVERITY_ACCENT[severityKey] || '#9e9e9e';

  return (
    <article
      className="flex items-center gap-3 px-5 py-3.5 rounded-[12px] border cursor-pointer transition-all duration-[160ms] outline-none min-w-0"
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
      aria-label={`View details for ${vuln.title || 'Vulnerability'}`}
    >
      <SeverityBadge severity={severityKey} cvss={vuln.cvss ?? 'N/A'} />
      <h2 className="w-[180px] flex-shrink-0 hidden sm:block truncate text-[0.88rem] font-bold" style={{ color: 'var(--text-heading)', fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace" }}>
        <span className="block truncate" title={vuln.id}>
          <HighlightText text={vuln.id || 'N/A'} query={activeQuery} />
        </span>
      </h2>
      <div className="flex-1 min-w-0">
        <p className="text-[0.88rem] font-medium leading-snug truncate" style={{ color: 'var(--text-secondary)' }} title={vuln.description || vuln.title}>
          <HighlightText text={vuln.description || vuln.title || 'Security Advisory'} query={activeQuery} />
        </p>
      </div>
      <span
        className="text-[0.8rem] font-medium flex-shrink-0 hidden md:block px-2.5 py-1 rounded-[5px] border max-w-[140px] truncate"
        style={{ color: 'var(--text-secondary)', background: 'var(--bg-badge)', borderColor: 'var(--border-card)' }}
        title={vuln.ecosystem}
      >
        {vuln.ecosystem || 'Security'}
      </span>
      <span className="text-[0.78rem] flex-shrink-0 hidden lg:flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <CalendarIcon />
        {vuln.date || 'N/A'}
      </span>
      <span className="flex-shrink-0 ml-1" style={{ color: 'var(--text-muted)' }}>
        <ChevronRightIcon />
      </span>
    </article>
  );
}

/* ── Export ── */
export default function VulnCard({ vuln, onClick, activeQuery, viewMode, isAdmin = false, onEdit }) {
  if (!vuln) return null;
  if (viewMode === 'list') {
    return <ListView vuln={vuln} onClick={onClick} activeQuery={activeQuery} isAdmin={isAdmin} onEdit={onEdit} />;
  }
  return <CardView vuln={vuln} onClick={onClick} activeQuery={activeQuery} isAdmin={isAdmin} onEdit={onEdit} />;
}
