import { useState, useEffect, useCallback } from 'react';

/* ─── Icons ─── */
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const WrenchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const ShieldCheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

/* ─── Sub-components ─── */
function SeverityBadge({ severity, cvss }) {
  return (
    <span className={`badge-${severity.toLowerCase()} text-[0.75rem] font-bold tracking-[0.05em] px-3 py-1 rounded-[6px] uppercase`}>
      {severity} {cvss}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = status === 'VULNERABLE' ? 'status-vulnerable' : status === 'PATCHED' ? 'status-patched' : '';
  return <span className={`${cls} text-[0.7rem] font-bold tracking-[0.04em] uppercase px-2.5 py-[3px] rounded-[6px]`}>{status}</span>;
}

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function FixThread({ fixes, onAddFix, onEditFix, onDeleteFix }) {
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');
  const [expandedIdx, setExpandedIdx] = useState(null);

  const TRUNCATE_LINES = 4;
  const inputStyle = { borderColor: 'var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-primary)' };
  const focusStyle = (e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; };
  const blurStyle = (e) => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!author.trim()) { setError('Author name is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }
    onAddFix({ author: author.trim(), description: description.trim(), timestamp: Date.now() });
    setAuthor(''); setDescription(''); setError('');
  };

  const startEdit = (i) => { setEditingIdx(i); setEditText(fixes[i].description); };
  const cancelEdit = () => { setEditingIdx(null); setEditText(''); };
  const saveEdit = (i) => {
    if (!editText.trim()) return;
    onEditFix(i, editText.trim());
    setEditingIdx(null); setEditText('');
  };

  return (
    <section className="mb-[22px]">
      <h3 className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-[0.08em] uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
        <WrenchIcon /> USER SUGGESTIONS
      </h3>

      <div className="flex flex-col">
        {/* ── Thread entries ── */}
        {fixes.map((fix, i) => {
          const isExpanded = expandedIdx === i;
          const isEditing = editingIdx === i;
          const descWords = fix.description.split('\n');
          const needsTruncate = fix.description.length > 300 || descWords.length > TRUNCATE_LINES;
          return (
            <div key={i} className="flex gap-3" style={{ animation: 'var(--animate-fade-slide-in)' }}>
              {/* Avatar + connector line */}
              <div className="flex flex-col items-center flex-shrink-0" style={{ width: '36px' }}>
                <div
                  className="w-9 h-9 rounded-full text-[0.875rem] font-bold flex items-center justify-center select-none flex-shrink-0 transition-colors duration-300"
                  style={{ background: 'var(--avatar-bg)', color: 'var(--avatar-text)' }}
                >
                  {fix.author.charAt(0).toUpperCase()}
                </div>
                {/* Thread connector line */}
                <div className="w-[2px] flex-1 mt-2" style={{ background: 'var(--border-color)', minHeight: '28px' }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-6">
                {/* Header: name + timestamp stacked */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-col">
                    <span className="text-[0.875rem] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>{fix.author}</span>
                    <span className="text-[0.72rem] mt-[2px]" style={{ color: 'var(--text-muted)' }}>{formatTimestamp(fix.timestamp)}</span>
                  </div>
                  {/* Edit / Delete actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(i)}
                        title="Edit note"
                        className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border-0 bg-transparent"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-badge)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeleteFix(i)}
                        title="Delete note"
                        className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border-0 bg-transparent"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Description — with expand/collapse */}
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={4}
                      className="px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[0.875rem] font-[inherit] outline-none resize-y min-h-[72px] leading-[1.5] transition-all duration-200 w-full"
                      style={inputStyle}
                      onFocus={focusStyle}
                      onBlur={blurStyle}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={cancelEdit}
                        className="h-8 px-3.5 rounded-[8px] border-[1.5px] text-[0.8rem] font-semibold font-[inherit] cursor-pointer transition-all duration-150"
                        style={{ borderColor: 'var(--border-input)', background: 'transparent', color: 'var(--text-secondary)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-badge)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >Cancel</button>
                      <button onClick={() => saveEdit(i)}
                        className="h-8 px-3.5 rounded-[8px] border-0 text-white text-[0.8rem] font-semibold font-[inherit] cursor-pointer transition-all duration-150"
                        style={{ background: 'var(--accent-blue)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
                      >Save</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p
                      className="text-[0.9rem] leading-[1.65] break-words whitespace-pre-wrap"
                      style={{
                        color: 'var(--text-secondary)',
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: isExpanded ? 'unset' : (needsTruncate ? TRUNCATE_LINES : 'unset'),
                        overflow: isExpanded ? 'visible' : (needsTruncate ? 'hidden' : 'visible'),
                      }}
                    >{fix.description}</p>
                    {needsTruncate && (
                      <button
                        onClick={() => setExpandedIdx(isExpanded ? null : i)}
                        className="mt-1 text-[0.8rem] font-semibold bg-transparent border-0 cursor-pointer px-0 py-0 transition-opacity duration-150 hover:opacity-70"
                        style={{ color: 'var(--accent-blue)' }}
                      >{isExpanded ? 'Show less' : 'Show more'}</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Compose / reply row ── */}
        <div className="flex gap-3">
          {/* Live avatar preview */}
          <div className="flex-shrink-0 pt-[3px]" style={{ width: '36px' }}>
            <div
              className="w-9 h-9 rounded-full border-[1.5px] text-[0.875rem] font-bold flex items-center justify-center select-none transition-all duration-200"
              style={author.trim()
                ? { background: 'var(--accent-blue)', borderColor: 'transparent', color: '#fff' }
                : { background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}
            >
              {author.trim() ? author.trim().charAt(0).toUpperCase() : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
          </div>

          {/* Form */}
          <form className="flex-1 min-w-0 flex flex-col gap-2.5 pt-[3px]" onSubmit={handleSubmit} noValidate>
            {fixes.length === 0 && !author && !description && (
              <p className="text-[0.875rem] italic mb-0.5" style={{ color: 'var(--text-muted)' }}>No suggestions yet. Be the first to add one.</p>
            )}
            <input
              id="fix-author-input"
              type="text"
              placeholder="Your name"
              value={author}
              onChange={(e) => { setAuthor(e.target.value); setError(''); }}
              aria-label="Author name"
              className="h-10 px-3.5 rounded-[10px] border-[1.5px] text-[0.875rem] font-[inherit] outline-none transition-all duration-200"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <textarea
              id="fix-desc-input"
              placeholder="What's the suggestion?"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(''); }}
              rows={3}
              aria-label="Fix description"
              className="px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[0.875rem] font-[inherit] outline-none resize-y min-h-[72px] leading-[1.5] transition-all duration-200 w-full"
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            {error && (
              <p className="text-[0.8125rem] rounded-[6px] px-3 py-2" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>
            )}
            <div className="flex justify-end">
              <button
                id="fix-submit-btn"
                type="submit"
                aria-label="Submit fix note"
                className="flex items-center gap-[7px] h-9 px-4 rounded-[20px] border-0 text-white text-[0.85rem] font-semibold font-[inherit] cursor-pointer flex-shrink-0 whitespace-nowrap transition-all duration-200 hover:-translate-y-px active:translate-y-0"
                style={{ background: 'var(--accent-blue)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
              >
                <SendIcon /><span>Post Note</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

/* ─── Main export ─── */
export default function DetailPanel({ vuln, onClose }) {
  const [fixes, setFixes] = useState([]);
  const [prevId, setPrevId] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  // Animated close — slides right then unmounts
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => onClose(), 280);
  }, [isClosing, onClose]);

  // ESC key handled here so it goes through the slide-out animation
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  // Reset fixes when switching vulnerabilities
  if (vuln && vuln.id !== prevId) { setFixes([]); setPrevId(vuln.id); }
  if (!vuln) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200]"
        style={{ background: 'var(--bg-overlay)', animation: isClosing ? 'var(--animate-fade-out)' : 'var(--animate-fade-in)' }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed top-0 right-0 w-[min(680px,100vw)] h-screen flex flex-col overflow-hidden z-[210] transition-colors duration-300"
        style={{
          background: 'var(--bg-panel)',
          boxShadow: 'var(--shadow-panel)',
          animation: isClosing ? 'var(--animate-slide-out)' : 'var(--animate-slide-in)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${vuln.title}`}
        id="detail-panel"
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 px-6 pt-[18px] flex-shrink-0" aria-label="Breadcrumb">
          {['Vulnerabilities'].map((item) => (
            <span key={item} className="flex items-center gap-1">
              <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>{item}</span>
              <ChevronIcon />
            </span>
          ))}
          <span className="text-[0.8125rem] font-medium" style={{ color: 'var(--text-primary)' }}>{vuln.id}</span>
        </nav>

        {/* Close button */}
        <button
          id="detail-close-btn"
          className="absolute top-3.5 right-5 w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-badge)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
          onClick={handleClose}
          aria-label="Close panel"
        >
          <CloseIcon />
        </button>

        {/* Scrollable content — only this scrolls, body is locked in App.jsx */}
        <div className="flex-1 overflow-y-auto px-7 pt-5 pb-10 flex flex-col gap-0">
          {/* Title & badge */}
          <div className="mb-5">
            <h2 className="text-[1.6rem] font-semibold leading-[1.2] tracking-[-0.02em] mb-2.5 transition-colors duration-300" style={{ color: 'var(--text-heading)' }}>
              {vuln.title}
            </h2>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[0.875rem] font-semibold" style={{ color: 'var(--text-secondary)', fontFamily: "'SF Mono','Fira Code',monospace" }}>{vuln.id}</span>
              <SeverityBadge severity={vuln.severity} cvss={vuln.cvss} />
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-[22px]">
            {[{ label: 'PUBLISHED', value: vuln.published }, { label: 'LAST UPDATED', value: vuln.lastUpdated }, { label: 'STATUS', value: vuln.status }, { label: vuln.cvssVersion, value: vuln.cvss }].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[0.7rem] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-[0.9375rem] font-semibold transition-colors duration-300" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          {/* Description */}
          <section className="mb-[22px]">
            <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>DESCRIPTION</h3>
            <p className="text-[0.9375rem] leading-[1.7] transition-colors duration-300" style={{ color: 'var(--text-secondary)' }}>{vuln.description}</p>
          </section>

          {/* Official Fix */}
          {vuln.remediation && (
            <section className="mb-[22px]">
              <h3 className="flex items-center gap-1.5 text-[0.72rem] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                OFFICIAL FIX
              </h3>
              <div
                className="flex items-center gap-3 px-4 py-3.5 rounded-[12px] border-[1.5px] transition-colors duration-300"
                style={{
                  background: 'var(--fix-card-bg)',
                  borderColor: 'var(--fix-card-border)',
                }}
              >
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--fix-icon-bg)', color: 'var(--fix-icon-color)' }}
                >
                  <ShieldCheckIcon />
                </span>
                <p className="text-[0.9375rem] font-semibold leading-[1.6] transition-colors duration-300" style={{ color: 'var(--fix-text-color)' }}>
                  {vuln.remediation}
                </p>
              </div>
            </section>
          )}

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          {/* Affected Components */}
          <section className="mb-[22px]">
            <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>AFFECTED COMPONENTS</h3>
            <div className="border rounded-[10px] overflow-x-auto" style={{ borderColor: 'var(--border-color)' }}>
              <table className="w-full border-collapse text-[0.875rem]">
                <thead style={{ background: 'var(--bg-table-head)' }}>
                  <tr>
                    {['Component', 'Affected Versions', 'Instance', 'Status'].map((h) => (
                      <th key={h} className="px-3.5 py-2.5 text-left text-[0.78rem] font-semibold border-b" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vuln.affectedComponents.map((comp, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? 'var(--bg-table-alt)' : 'var(--bg-table-row)' }}>
                      <td className="px-3.5 py-3 border-b last:border-b-0 font-semibold text-[0.84rem]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontFamily: "'SF Mono','Fira Code',monospace" }}>{comp.component}</td>
                      <td className="px-3.5 py-3 border-b last:border-b-0 align-middle" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{comp.affectedVersions}</td>
                      <td className="px-3.5 py-3 border-b last:border-b-0 align-middle" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>{comp.instance}</td>
                      <td className="px-3.5 py-3 border-b last:border-b-0 align-middle" style={{ borderColor: 'var(--border-color)' }}><StatusBadge status={comp.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          {/* References */}
          <section className="mb-[22px]">
            <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>REFERENCES</h3>
            <div className="flex flex-col gap-2.5">
              {vuln.references.map((ref, i) => (
                <a key={i} href={`https://${ref.url}`} target="_blank" rel="noopener noreferrer" id={`ref-link-${i}`}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] border no-underline transition-all duration-200"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.background = 'var(--accent-blue-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}>
                  <span className="flex flex-shrink-0" style={{ color: 'var(--accent-blue)' }}><ExternalLinkIcon /></span>
                  <span className="text-[0.875rem] font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{ref.name}</span>
                  <span className="text-[0.8rem] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{ref.url}</span>
                </a>
              ))}
            </div>
          </section>

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          <FixThread
            fixes={fixes}
            onAddFix={(fix) => setFixes((prev) => [...prev, fix])}
            onEditFix={(i, newDesc) => setFixes((prev) => prev.map((f, idx) => idx === i ? { ...f, description: newDesc } : f))}
            onDeleteFix={(i) => setFixes((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </div>
      </aside>
    </>
  );
}
