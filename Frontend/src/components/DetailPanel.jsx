import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchVulnerabilityById,
  fetchManualGuidance,
  createManualGuidance,
  updateManualGuidance,
  deleteManualGuidance,
} from '../services/api';
import CustomDatePicker from './CustomDatePicker';
import { getEcosystemList, formatEcosystemName } from './VulnCard';

/* ─── Ecosystem Tag Manager Component ─── */
function EcosystemTagInput({
  ecosystemsList,
  onChange,
  hasError,
  baseEditableStyle,
  baseEditableBorderColor,
  handleEditableMouseEnter,
  handleEditableMouseLeave,
}) {
  const [tagInput, setTagInput] = useState('');

  const addTags = (input) => {
    if (!input || !input.trim()) return;
    const parts = input.split(/[,;/]\s*/).map(formatEcosystemName).filter(Boolean);
    if (parts.length === 0) return;
    const updated = [...new Set([...ecosystemsList, ...parts])];
    updated.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    onChange(updated);
    setTagInput('');
  };

  const removeTag = (tagToRemove) => {
    const updated = ecosystemsList.filter((t) => t !== tagToRemove);
    onChange(updated);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTags(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && ecosystemsList.length > 0) {
      removeTag(ecosystemsList[ecosystemsList.length - 1]);
    }
  };

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap p-2 rounded-[8px] min-h-[38px] transition-all cursor-text"
      style={{
        ...baseEditableStyle,
        borderColor: hasError ? '#ef4444' : baseEditableBorderColor,
      }}
      onMouseEnter={handleEditableMouseEnter}
      onMouseLeave={handleEditableMouseLeave}
    >
      {ecosystemsList.map((eco) => (
        <span
          key={eco}
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[5px] text-xs font-bold"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            color: 'var(--text-primary)',
          }}
        >
          {eco}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(eco);
            }}
            className="hover:text-red-500 font-bold ml-1 text-[0.85rem] transition-colors cursor-pointer"
            aria-label={`Remove ${eco}`}
            style={{ color: 'var(--text-muted)' }}
          >
            &times;
          </button>
        </span>
      ))}
      <input
        type="text"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (tagInput.trim()) addTags(tagInput);
        }}
        placeholder={ecosystemsList.length === 0 ? "Type ecosystem & press Enter..." : "+ Add..."}
        className="flex-1 min-w-[120px] text-xs bg-transparent outline-none font-semibold cursor-text"
        style={{ color: 'var(--text-primary)' }}
      />
    </div>
  );
}

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
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/* ─── Sub-components ─── */
function SeverityBadge({ severity }) {
  return (
    <span className={`badge-${(severity || '').toLowerCase()} text-[0.75rem] font-bold tracking-[0.05em] px-3 py-1 rounded-[6px] uppercase`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const cls = status === 'VULNERABLE' ? 'status-vulnerable' : status === 'PATCHED' ? 'status-patched' : '';
  return <span className={`${cls} text-[0.7rem] font-bold tracking-[0.04em] uppercase px-2.5 py-[3px] rounded-[6px] inline-block whitespace-nowrap`}>{status}</span>;
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
                  <div className="flex flex-col min-w-0">
                    <span className="text-[0.875rem] font-bold leading-tight truncate max-w-[220px]" style={{ color: 'var(--text-primary)' }} title={fix.author}>{fix.author}</span>
                    <span className="text-[0.72rem] mt-[2px] truncate" style={{ color: 'var(--text-muted)' }}>{formatTimestamp(fix.timestamp)}</span>
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
              maxLength={40}
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
              maxLength={1000}
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

// Date conversion helpers for CustomDatePicker
const formatForDateInput = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return trimmed;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${day}-${month}-${year}`;
};

const formatForDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ─── Minimal Ecosystem Badges with Popover Truncation ─── */
function MinimalEcosystemList({ ecosystems }) {
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopover]);

  if (!ecosystems || ecosystems.length === 0) {
    return <span className="text-[0.88rem] font-semibold" style={{ color: 'var(--text-primary)' }}>N/A</span>;
  }

  const limit = 3;
  const showMore = ecosystems.length > limit;
  const visible = ecosystems.slice(0, limit);
  const remainingCount = ecosystems.length - limit;

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1.5 flex-wrap">
        {visible.map((eco, idx) => (
          <span
            key={idx}
            className="text-[0.78rem] font-medium px-2 py-0.5 rounded-[5px] truncate max-w-[140px] inline-block transition-colors"
            style={{
              background: 'var(--bg-badge)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-card)',
            }}
            title={eco}
          >
            {eco}
          </span>
        ))}

        {showMore && (
          <button
            type="button"
            onClick={() => setShowPopover(!showPopover)}
            className="text-[0.72rem] font-semibold px-2 py-0.5 rounded-[5px] border cursor-pointer transition-all duration-150 flex items-center gap-1 hover:opacity-90"
            style={{
              background: 'var(--accent-blue-light)',
              color: 'var(--accent-blue)',
              borderColor: 'rgba(37, 99, 235, 0.28)',
            }}
            title={showPopover ? 'Close ecosystems list' : `View all ${ecosystems.length} ecosystems`}
          >
            <span>+{remainingCount} more</span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`transition-transform duration-200 ${showPopover ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {/* Floating Mini Window Overlaying Towards Left showing ALL Ecosystems */}
      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute top-full mt-1.5 right-0 z-[300] p-3 rounded-[10px] border shadow-2xl flex flex-col gap-2 min-w-[260px] max-w-[340px]"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fadeSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: 'var(--border-color)' }}>
            <span className="text-[0.68rem] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              All Ecosystems ({ecosystems.length})
            </span>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="text-[0.72rem] font-bold text-gray-400 hover:text-gray-200 cursor-pointer px-1 transition-colors"
              aria-label="Close window"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap max-h-[180px] overflow-y-auto pt-1">
            {ecosystems.map((eco, idx) => (
              <span
                key={idx}
                className="text-[0.75rem] font-medium px-2 py-0.5 rounded-[5px] border truncate"
                style={{
                  background: 'var(--bg-badge)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-card)',
                }}
              >
                {eco}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main export ─── */
export default function DetailPanel({ vuln, onClose, isAdmin = false, onSave }) {
  const [detailData, setDetailData] = useState(vuln);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [fixes, setFixes] = useState([]);
  const [prevId, setPrevId] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [isFixExpanded, setIsFixExpanded] = useState(false);
  const [isComponentsExpanded, setIsComponentsExpanded] = useState(false);
  const [isReferencesExpanded, setIsReferencesExpanded] = useState(false);

  // Inline Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editCveId, setEditCveId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSeverity, setEditSeverity] = useState('');
  const [editCvss, setEditCvss] = useState('');
  const [editEcosystem, setEditEcosystem] = useState('');
  const [editEcosystemsList, setEditEcosystemsList] = useState([]);
  const [editTechName, setEditTechName] = useState('');
  const [editPublished, setEditPublished] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRemediation, setEditRemediation] = useState('');
  const [editAffectedComponents, setEditAffectedComponents] = useState([]);
  const [editReferences, setEditReferences] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const displayId = vuln?.display_id || vuln?.id;

  // Validation method
  const validateForm = () => {
    const errors = {};
    const target = detailData || vuln;
    const isNew = vuln?.isNew;

    // Check if mandatory fields were already blank initially on an existing record
    const wasTitleBlank = !isNew && !target?.title?.trim();
    const wasSeverityBlank = !isNew && !target?.severity;
    const wasEcosystemBlank = !isNew && !target?.ecosystem?.trim();
    const wasTechNameBlank = !isNew && !target?.tech_name?.trim() && !target?.techName?.trim();
    const wasStatusBlank = !isNew && !target?.status;
    const wasPublishedBlank = !isNew && !target?.published?.trim() && !target?.date?.trim();
    const wasCvssBlank = !isNew && (target?.cvss === undefined || target?.cvss === null || String(target?.cvss).trim() === '' || String(target?.cvss).trim() === 'N/A');
    const wasDescriptionBlank = !isNew && !target?.description?.trim();

    if (!editTitle.trim()) {
      if (!wasTitleBlank) errors.title = 'Title is required and cannot be blank.';
    } else if (editTitle.trim().length > 150) {
      errors.title = 'Title must be 150 characters or less.';
    }

    if (!editSeverity && !wasSeverityBlank) {
      errors.severity = 'Severity is required.';
    }

    if (!editEcosystem.trim()) {
      if (!wasEcosystemBlank) errors.ecosystem = 'Ecosystem is required and cannot be blank.';
    } else if (editEcosystem.trim().length > 50) {
      errors.ecosystem = 'Ecosystem must be 50 characters or less.';
    }

    if (!editTechName.trim()) {
      if (!wasTechNameBlank) errors.techName = 'Tech Name is required and cannot be blank.';
    } else if (editTechName.trim().length > 50) {
      errors.techName = 'Tech Name must be 50 characters or less.';
    }

    if (!editStatus && !wasStatusBlank) {
      errors.status = 'Status is required.';
    }

    if (!editPublished.trim()) {
      if (!wasPublishedBlank) errors.published = 'Published Date is required and cannot be blank.';
    } else if (editPublished.trim().length > 30) {
      errors.published = 'Published Date must be 30 characters or less.';
    }

    if (editCvss === '' || editCvss === null || editCvss === undefined) {
      if (!wasCvssBlank) errors.cvss = 'CVSS score is required.';
    } else {
      const cvssNum = parseFloat(editCvss);
      if (isNaN(cvssNum) || cvssNum < 0 || cvssNum > 10) {
        errors.cvss = 'CVSS score must be a number between 0.0 and 10.0.';
      }
    }

    if (!editDescription.trim()) {
      if (!wasDescriptionBlank) errors.description = 'Description is required and cannot be blank.';
    } else if (editDescription.trim().length > 2000) {
      errors.description = 'Description must be 2000 characters or less.';
    }

    if (editRemediation && editRemediation.trim().length > 1000) {
      errors.remediation = 'Remediation guidance must be 1000 characters or less.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Affected Components & References Edit Handlers
  const handleAddComponent = () => {
    setEditAffectedComponents((prev) => [
      ...prev,
      { component: '', affectedVersions: '', instance: 'All instances', status: 'VULNERABLE' },
    ]);
  };

  const handleUpdateComponent = (index, field, value) => {
    setEditAffectedComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveComponent = (index) => {
    setEditAffectedComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddReference = () => {
    setEditReferences((prev) => [...prev, { name: '', url: '' }]);
  };

  const handleUpdateReference = (index, field, value) => {
    setEditReferences((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveReference = (index) => {
    setEditReferences((prev) => prev.filter((_, i) => i !== index));
  };

  // API 2: Fetch specific vulnerability by display_id when panel opens or selection changes
  useEffect(() => {
    if (!displayId || vuln?.isNew) return;

    let isMounted = true;
    setLoadingDetail(true);

    fetchVulnerabilityById(displayId)
      .then((fetchedData) => {
        if (isMounted && fetchedData) {
          setDetailData(fetchedData);
        }
      })
      .catch((err) => {
        console.error('API 2 detail fetch error:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingDetail(false);
      });

    // Fetch manual guidance (comments) for this vulnerability
    fetchManualGuidance(displayId)
      .then((remediations) => {
        if (isMounted && remediations) {
          setFixes(remediations);
        }
      })
      .catch((err) => {
        console.error('Manual guidance fetch error:', err);
      });

    return () => { isMounted = false; };
  }, [displayId, vuln?.isNew]);

  const handleAddFix = async (newFix) => {
    const targetDisplayId = (detailData || vuln)?.display_id || displayId;
    if (targetDisplayId && !vuln?.isNew) {
      const created = await createManualGuidance(targetDisplayId, newFix);
      if (created) {
        setFixes((prev) => [created, ...prev]);
        return;
      }
    }
    setFixes((prev) => [{ ...newFix, id: `local-${Date.now()}` }, ...prev]);
  };

  const handleEditFix = async (index, newDescription) => {
    const targetFix = fixes[index];
    if (targetFix && targetFix.id && !String(targetFix.id).startsWith('local-')) {
      await updateManualGuidance(targetFix.id, newDescription);
    }
    setFixes((prev) =>
      prev.map((f, i) => (i === index ? { ...f, description: newDescription } : f))
    );
  };

  const handleDeleteFix = async (index) => {
    const targetFix = fixes[index];
    if (targetFix && targetFix.id && !String(targetFix.id).startsWith('local-')) {
      await deleteManualGuidance(targetFix.id);
    }
    setFixes((prev) => prev.filter((_, i) => i !== index));
  };

  // Sync edit form fields when entering edit mode or when data changes
  const startEditing = () => {
    const target = detailData || vuln;
    setFormErrors({});
    setEditCveId(target.display_id || target.id || '');
    setEditTitle(target.title || '');
    setEditSeverity(target.severity ? target.severity.toUpperCase() : '');
    setEditCvss(target.cvss !== undefined && target.cvss !== null ? String(target.cvss) : '');
    const ecosList = getEcosystemList(target);
    setEditEcosystemsList(ecosList);
    setEditEcosystem(ecosList.join(', '));
    setEditTechName(target.tech_name || '');
    setEditPublished(formatForDateInput(target.published || target.date || ''));
    setEditStatus(target.status || '');
    setEditDescription(target.description || '');
    setEditRemediation(typeof target.remediation === 'string' ? target.remediation : '');
    setEditAffectedComponents(target.affectedComponents ? target.affectedComponents.map(c => ({ ...c })) : []);
    setEditReferences(target.references ? target.references.map(r => ({ ...r })) : []);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setFormErrors({});
    if (vuln?.isNew) {
      handleClose();
    } else {
      setIsEditing(false);
    }
  };

  const handleSaveInline = () => {
    if (!validateForm()) {
      return;
    }
    const target = detailData || vuln;
    const cvssVal = editCvss.trim() !== '' ? Math.min(10, Math.max(0, parseFloat(editCvss) || 0)) : (target.cvss !== undefined && target.cvss !== null ? target.cvss : '');

    const cleanedComponents = editAffectedComponents.filter((c) => c.component.trim() || c.affectedVersions.trim());
    const cleanedReferences = editReferences.filter((r) => r.url.trim() || r.name.trim());

    const finalId = editCveId.trim() || target.display_id || target.id || `VULN-${Date.now()}`;
    const formattedPublished = editPublished.trim() ? (formatForDisplayDate(editPublished.trim()) || editPublished.trim()) : '';

    const sortedEcos = editEcosystemsList.length > 0
      ? [...editEcosystemsList].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      : editEcosystem.split(/[,;/]\s*/).map(formatEcosystemName).filter(Boolean);

    const updatedRecord = {
      ...target,
      id: finalId,
      display_id: finalId,
      title: editTitle.trim(),
      severity: editSeverity ? editSeverity.toUpperCase() : '',
      cvss: cvssVal,
      ecosystem: sortedEcos.join(', '),
      ecosystems: sortedEcos.length > 0 ? sortedEcos : ['Security'],
      tech_name: editTechName.trim(),
      published: formattedPublished,
      date: formattedPublished,
      status: editStatus,
      description: editDescription.trim(),
      remediation: editRemediation.trim(),
      affectedComponents: cleanedComponents,
      references: cleanedReferences,
      official_fix: {
        steps: editRemediation.trim(),
        command: '',
        verified: true,
      },
    };

    setDetailData(updatedRecord);
    setFormErrors({});
    if (onSave) {
      onSave(updatedRecord);
    }
    setIsEditing(false);
    if (vuln?.isNew) {
      handleClose();
    }
  };

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

  // Reset fixes and edit mode when switching vulnerabilities or creating new
  useEffect(() => {
    if (vuln) {
      setDetailData(vuln);
      setFixes([]);
      setPrevId(vuln.id);
      setIsDescExpanded(false);
      setIsFixExpanded(false);
      setIsComponentsExpanded(false);
      setIsReferencesExpanded(false);
      if (vuln.isNew) {
        setEditCveId(vuln.display_id || vuln.id || '');
        setEditTitle(vuln.title || '');
        setEditSeverity(vuln.severity ? vuln.severity.toUpperCase() : '');
        setEditCvss(vuln.cvss ? String(vuln.cvss) : '');
        const initialEcos = getEcosystemList(vuln);
        setEditEcosystemsList(initialEcos);
        setEditEcosystem(initialEcos.join(', '));
        setEditTechName(vuln.tech_name || '');
        setEditPublished(formatForDateInput(vuln.published || vuln.date || ''));
        setEditStatus(vuln.status || '');
        setEditDescription(vuln.description || '');
        setEditRemediation(typeof vuln.remediation === 'string' ? vuln.remediation : '');
        setEditAffectedComponents(
          vuln.affectedComponents && vuln.affectedComponents.length > 0
            ? vuln.affectedComponents.map(c => ({ ...c }))
            : []
        );
        setEditReferences(
          vuln.references && vuln.references.length > 0
            ? vuln.references.map(r => ({ ...r }))
            : []
        );
        setIsEditing(true);
      } else if (vuln.id !== prevId) {
        setIsEditing(false);
      }
    }
  }, [vuln, prevId]);

  if (!vuln) return null;

  const current = detailData || vuln;

  // Subtle interactive field styling for Inline Edit mode
  const baseEditableBorderColor = 'var(--border-input, #cbd5e1)';

  const baseEditableStyle = {
    borderWidth: '1.5px',
    borderStyle: 'dashed',
    borderColor: baseEditableBorderColor,
    background: 'var(--bg-badge)',
    color: 'var(--text-primary)',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    outline: 'none',
  };

  const handleEditableFocus = (e) => {
    e.currentTarget.style.borderColor = 'var(--accent-blue)';
    e.currentTarget.style.borderStyle = 'solid';
    e.currentTarget.style.borderWidth = '1.5px';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.18)';
    e.currentTarget.style.background = 'var(--bg-input)';
  };

  const handleEditableBlur = (e) => {
    e.currentTarget.style.borderColor = baseEditableBorderColor;
    e.currentTarget.style.borderStyle = 'dashed';
    e.currentTarget.style.borderWidth = '1.5px';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.background = 'var(--bg-badge)';
  };

  const handleEditableMouseEnter = (e) => {
    if (document.activeElement !== e.currentTarget) {
      e.currentTarget.style.borderColor = 'var(--accent-blue)';
      e.currentTarget.style.background = 'var(--accent-blue-light)';
    }
  };

  const handleEditableMouseLeave = (e) => {
    if (document.activeElement !== e.currentTarget) {
      e.currentTarget.style.borderColor = baseEditableBorderColor;
      e.currentTarget.style.borderWidth = '1.5px';
      e.currentTarget.style.background = 'var(--bg-badge)';
    }
  };

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
        className="fixed inset-y-0 right-0 w-[min(680px,100vw)] flex flex-col overflow-hidden z-[210] transition-colors duration-300"
        style={{
          background: 'var(--bg-panel)',
          boxShadow: 'var(--shadow-panel)',
          animation: isClosing ? 'var(--animate-slide-out)' : 'var(--animate-slide-in)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${current.title}`}
        id="detail-panel"
      >
        {/* Breadcrumb & Action bar */}
        <div className="flex items-center justify-between px-6 pt-[18px] flex-shrink-0 min-w-0 pr-14">
          <nav className="flex items-center gap-1.5 flex-shrink-0 min-w-0" aria-label="Breadcrumb">
            <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>Vulnerabilities</span>
            <ChevronIcon />
            <span className="text-[0.8125rem] font-semibold truncate max-w-[200px]" style={{ color: 'var(--text-primary)' }} title={current.id}>
              {vuln?.isNew ? 'New Advisory' : current.id}
            </span>
            {loadingDetail && !vuln?.isNew && (
              <span className="ml-2 text-[0.7rem] px-2 py-0.5 rounded animate-pulse flex-shrink-0" style={{ background: 'var(--bg-badge)', color: 'var(--accent-blue)' }}>
                Loading API data...
              </span>
            )}
          </nav>

          {/* Admin Controls: Toggle between View and Inline Edit mode */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.68rem] font-bold tracking-wider uppercase mr-1" style={{ background: vuln?.isNew ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-blue-light)', color: vuln?.isNew ? '#10b981' : 'var(--accent-blue)', border: vuln?.isNew ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(37,99,235,0.2)' }}>
                    <EditIcon /> {vuln?.isNew ? 'NEW ADVISORY' : 'EDITING'}
                  </span>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-3 py-1 rounded-[6px] text-xs font-semibold border cursor-pointer transition-all duration-150"
                    style={{
                      borderColor: 'var(--border-card)',
                      background: 'var(--bg-badge)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--border-card)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.borderColor = 'var(--border-input)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-badge)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-card)';
                      e.currentTarget.style.transform = 'translateY(0px)';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveInline}
                    className="px-3.5 py-1 rounded-[6px] text-xs font-bold text-white cursor-pointer transition-all duration-150 border-0 shadow-sm"
                    style={{ background: vuln?.isNew ? '#10b981' : 'var(--accent-blue)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = vuln?.isNew ? '#059669' : '#1d4ed8';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = vuln?.isNew ? '0 4px 12px rgba(16, 185, 129, 0.35)' : '0 4px 12px rgba(37, 99, 235, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = vuln?.isNew ? '#10b981' : 'var(--accent-blue)';
                      e.currentTarget.style.transform = 'translateY(0px)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {vuln?.isNew ? 'Create Vulnerability' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEditing}
                  className="px-3 py-1 rounded-[6px] text-xs font-bold border cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                  style={{
                    borderColor: 'var(--accent-blue)',
                    background: 'var(--accent-blue-light)',
                    color: 'var(--accent-blue)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent-blue)';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--accent-blue-light)';
                    e.currentTarget.style.color = 'var(--accent-blue)';
                  }}
                  title="Enable inline editing for this vulnerability"
                >
                  <EditIcon />
                  <span>Edit Advisory</span>
                </button>
              )}
            </div>
          )}
        </div>

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
        <div className="flex-1 overflow-y-auto px-7 pt-5 pb-20 flex flex-col gap-0 min-w-0">
          {/* Validation Errors Summary Banner */}
          {isEditing && Object.keys(formErrors).length > 0 && (
            <div className="mb-5 p-3.5 rounded-[10px] bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex flex-col gap-1.5 animate-fadeIn">
              <div className="font-bold flex items-center gap-1.5 text-[0.82rem]">
                <span>⚠️ Please correct the following errors before saving:</span>
              </div>
              <ul className="list-disc list-inside pl-1 flex flex-col gap-1 font-medium text-[0.78rem]">
                {Object.values(formErrors).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Title & ID Header */}
          <div className="mb-5 min-w-0">
            {isEditing ? (
              <div className="flex flex-col gap-1 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.title ? '#ef4444' : 'var(--text-muted)' }}>
                    ADVISORY TITLE *
                  </span>
                  <span className="text-[0.68rem] font-semibold" style={{ color: editTitle.length >= 150 ? '#ef4444' : 'var(--text-muted)' }}>
                    {editTitle.length}/150
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value);
                    if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: null }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-[10px] text-[1.35rem] font-semibold leading-[1.25] tracking-[-0.02em] cursor-text"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.title ? '#ef4444' : baseEditableBorderColor,
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                  placeholder="Enter Advisory Title..."
                />
                {formErrors.title && <span className="text-[0.72rem] text-red-500 font-semibold mt-0.5">{formErrors.title}</span>}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3.5 mb-3 flex-wrap">
                  <h2
                    className="text-[1.45rem] font-bold leading-tight tracking-[-0.01em] transition-colors duration-300 break-all"
                    style={{ color: 'var(--text-heading)', fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace" }}
                    title={current.id}
                  >
                    {current.id}
                  </h2>
                  <SeverityBadge severity={current.severity} cvss={current.cvss} />
                </div>
              </div>
            )}

            {isEditing && (
              <div className="flex items-center gap-2.5 flex-wrap min-w-0 transition-all px-3.5 mb-2">
                <div className="flex items-center gap-2 min-w-[200px]">
                  <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>CVE ID</span>
                  <input
                    type="text"
                    maxLength={50}
                    value={editCveId}
                    onChange={(e) => setEditCveId(e.target.value)}
                    placeholder="e.g. CVE-2026-66140 (optional)"
                    className="px-2.5 py-1 rounded text-xs font-semibold uppercase font-mono cursor-text"
                    style={baseEditableStyle}
                    onFocus={handleEditableFocus}
                    onBlur={handleEditableBlur}
                    onMouseEnter={handleEditableMouseEnter}
                    onMouseLeave={handleEditableMouseLeave}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Meta grid (Severity, CVSS, Ecosystem, Tech Name, Status, Published) */}
          {isEditing ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mb-[22px] p-3.5 rounded-[12px] border transition-colors" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
              <div className="flex flex-col gap-1">
                <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.severity ? '#ef4444' : 'var(--text-muted)' }}>SEVERITY *</span>
                <select
                  value={editSeverity}
                  onChange={(e) => {
                    setEditSeverity(e.target.value);
                    if (formErrors.severity) setFormErrors((prev) => ({ ...prev, severity: null }));
                  }}
                  className="px-3 py-1.5 rounded-[8px] text-xs cursor-pointer transition-colors"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.severity ? '#ef4444' : baseEditableBorderColor,
                    color: !editSeverity ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: !editSeverity ? '500' : '700',
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                >
                  <option value="" disabled style={{ color: 'var(--text-muted)' }}>Select Severity...</option>
                  <option value="CRITICAL" style={{ color: 'var(--text-primary)' }}>CRITICAL</option>
                  <option value="HIGH" style={{ color: 'var(--text-primary)' }}>HIGH</option>
                  <option value="MEDIUM" style={{ color: 'var(--text-primary)' }}>MEDIUM</option>
                  <option value="LOW" style={{ color: 'var(--text-primary)' }}>LOW</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.cvss ? '#ef4444' : 'var(--text-muted)' }}>CVSS SCORE * (0-10)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={editCvss}
                  onChange={(e) => {
                    setEditCvss(e.target.value);
                    if (formErrors.cvss) setFormErrors((prev) => ({ ...prev, cvss: null }));
                  }}
                  className="px-3 py-1.5 rounded-[8px] text-xs font-bold cursor-text"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.cvss ? '#ef4444' : baseEditableBorderColor,
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                />
              </div>

              <div className="flex flex-col gap-1 col-span-2 sm:col-span-3">
                <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.ecosystem ? '#ef4444' : 'var(--text-muted)' }}>AFFECTED ECOSYSTEMS *</span>
                <EcosystemTagInput
                  ecosystemsList={editEcosystemsList}
                  onChange={(newList) => {
                    setEditEcosystemsList(newList);
                    setEditEcosystem(newList.join(', '));
                    if (formErrors.ecosystem) setFormErrors((prev) => ({ ...prev, ecosystem: null }));
                  }}
                  hasError={!!formErrors.ecosystem}
                  baseEditableStyle={baseEditableStyle}
                  baseEditableBorderColor={baseEditableBorderColor}
                  handleEditableMouseEnter={handleEditableMouseEnter}
                  handleEditableMouseLeave={handleEditableMouseLeave}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.techName ? '#ef4444' : 'var(--text-muted)' }}>TECH NAME *</span>
                <input
                  type="text"
                  maxLength={50}
                  value={editTechName}
                  onChange={(e) => {
                    setEditTechName(e.target.value);
                    if (formErrors.techName) setFormErrors((prev) => ({ ...prev, techName: null }));
                  }}
                  placeholder="e.g. Python, Express"
                  className="px-3 py-1.5 rounded-[8px] text-xs font-semibold cursor-text"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.techName ? '#ef4444' : baseEditableBorderColor,
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.status ? '#ef4444' : 'var(--text-muted)' }}>STATUS *</span>
                <select
                  value={editStatus}
                  onChange={(e) => {
                    setEditStatus(e.target.value);
                    if (formErrors.status) setFormErrors((prev) => ({ ...prev, status: null }));
                  }}
                  className="px-3 py-1.5 rounded-[8px] text-xs cursor-pointer transition-colors"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.status ? '#ef4444' : baseEditableBorderColor,
                    color: !editStatus ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: !editStatus ? '500' : '700',
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                >
                  <option value="" disabled style={{ color: 'var(--text-muted)' }}>Select Status...</option>
                  <option value="VULNERABLE" style={{ color: 'var(--text-primary)' }}>VULNERABLE</option>
                  <option value="PATCHED" style={{ color: 'var(--text-primary)' }}>PATCHED</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[0.68rem] font-bold tracking-[0.05em] uppercase" style={{ color: formErrors.published ? '#ef4444' : 'var(--text-muted)' }}>PUBLISHED DATE *</span>
                <CustomDatePicker
                  value={editPublished}
                  onChange={(val) => {
                    setEditPublished(val);
                    if (formErrors.published) setFormErrors((prev) => ({ ...prev, published: null }));
                  }}
                  disableFuture={false}
                  placeholder="DD-MM-YYYY"
                  hasError={!!formErrors.published}
                  align="right"
                  inputClassName="py-1.5 cursor-pointer"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.published ? '#ef4444' : baseEditableBorderColor,
                    height: '33px',
                    borderRadius: '8px',
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-8 sm:gap-12 mb-[22px] py-1 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[0.7rem] font-bold tracking-[0.06em] uppercase truncate" style={{ color: 'var(--text-muted)' }}>PUBLISHED</span>
                <span className="text-[0.9375rem] font-semibold transition-colors duration-300 truncate" style={{ color: 'var(--text-primary)' }} title={String(current.published ?? '')}>
                  {current.published || 'N/A'}
                </span>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[0.7rem] font-bold tracking-[0.06em] uppercase truncate" style={{ color: 'var(--text-muted)' }}>CVSS Score</span>
                <span className="text-[0.9375rem] font-semibold transition-colors duration-300 truncate" style={{ color: 'var(--text-primary)' }} title={String(current.cvss ?? '')}>
                  {current.cvss ?? 'N/A'}
                </span>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[0.7rem] font-bold tracking-[0.06em] uppercase truncate" style={{ color: 'var(--text-muted)' }}>
                  {getEcosystemList(current).length > 1 ? 'ECOSYSTEMS' : 'ECOSYSTEM'}
                </span>
                <MinimalEcosystemList ecosystems={getEcosystemList(current)} />
              </div>
            </div>
          )}

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          {/* Description */}
          <section className="mb-[22px] min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase" style={{ color: formErrors.description ? '#ef4444' : 'var(--text-muted)' }}>
                DESCRIPTION *
              </h3>
              {isEditing && (
                <span className="text-[0.68rem] font-semibold" style={{ color: editDescription.length >= 2000 ? '#ef4444' : 'var(--text-muted)' }}>
                  {editDescription.length}/2000
                </span>
              )}
            </div>
            {isEditing ? (
              <div className="flex flex-col gap-1">
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={editDescription}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                    if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: null }));
                  }}
                  className="w-full p-3.5 rounded-[10px] text-sm outline-none leading-relaxed transition-all font-[inherit] cursor-text"
                  style={{
                    ...baseEditableStyle,
                    borderColor: formErrors.description ? '#ef4444' : baseEditableBorderColor,
                  }}
                  onFocus={handleEditableFocus}
                  onBlur={handleEditableBlur}
                  onMouseEnter={handleEditableMouseEnter}
                  onMouseLeave={handleEditableMouseLeave}
                  placeholder="Enter vulnerability description..."
                />
                {formErrors.description && <span className="text-[0.72rem] text-red-500 font-semibold">{formErrors.description}</span>}
              </div>
            ) : (
              <div>
                <p
                  className="text-[0.9375rem] leading-[1.7] transition-colors duration-300 break-words whitespace-pre-wrap"
                  style={{
                    color: 'var(--text-secondary)',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: isDescExpanded ? 'unset' : ((current.description && current.description.length > 220) ? 3 : 'unset'),
                    overflow: isDescExpanded ? 'visible' : ((current.description && current.description.length > 220) ? 'hidden' : 'visible'),
                  }}
                >
                  {current.description}
                </p>
                {current.description && current.description.length > 220 && (
                  <button
                    onClick={() => setIsDescExpanded((v) => !v)}
                    className="mt-1 text-[0.8rem] font-semibold bg-transparent border-0 cursor-pointer px-0 py-0 transition-opacity duration-150 hover:opacity-80 flex items-center gap-1"
                    style={{ color: 'var(--accent-blue)' }}
                  >
                    <span>{isDescExpanded ? 'Show less' : 'Read more'}</span>
                    <span className="text-[0.75rem]">{isDescExpanded ? '▲' : '▼'}</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Official Fix */}
          <section className="mb-[22px] min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--text-muted)' }}>
                OFFICIAL FIX / REMEDIATION
              </h3>
              {isEditing && (
                <span className="text-[0.68rem] font-semibold" style={{ color: editRemediation.length >= 1000 ? '#ef4444' : 'var(--text-muted)' }}>
                  {editRemediation.length}/1000
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                rows={3}
                maxLength={1000}
                value={editRemediation}
                onChange={(e) => setEditRemediation(e.target.value)}
                placeholder="Remediation guidance..."
                className="w-full p-3.5 rounded-[10px] text-sm outline-none leading-relaxed transition-all font-[inherit] cursor-text"
                style={baseEditableStyle}
                onFocus={handleEditableFocus}
                onBlur={handleEditableBlur}
                onMouseEnter={handleEditableMouseEnter}
                onMouseLeave={handleEditableMouseLeave}
              />
            ) : current.remediation ? (
              <div
                className="flex flex-col gap-2.5 px-4 py-3.5 rounded-[12px] border-[1.5px] transition-colors duration-300 min-w-0"
                style={{
                  background: 'var(--fix-card-bg)',
                  borderColor: 'var(--fix-card-border)',
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: 'var(--fix-icon-bg)', color: 'var(--fix-icon-color)' }}
                  >
                    <ShieldCheckIcon />
                  </span>
                  <div className="flex-1 min-w-0">
                    {!isFixExpanded ? (
                      <p
                        className="text-[0.9375rem] font-semibold leading-[1.6] transition-colors duration-300 break-words line-clamp-3"
                        style={{ color: 'var(--fix-text-color)' }}
                      >
                        {current.remediation}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {current.remediation.includes(';') ? (
                          <ul className="list-disc list-inside flex flex-col gap-1.5 text-[0.88rem] font-semibold leading-[1.6]" style={{ color: 'var(--fix-text-color)' }}>
                            {current.remediation.split(';').map((item, idx) => {
                              const trimmed = item.trim();
                              if (!trimmed) return null;
                              return <li key={idx} className="break-words">{trimmed}</li>;
                            })}
                          </ul>
                        ) : (
                          <p className="text-[0.9375rem] font-semibold leading-[1.6] transition-colors duration-300 break-words" style={{ color: 'var(--fix-text-color)' }}>
                            {current.remediation}
                          </p>
                        )}
                      </div>
                    )}
                    {current.remediation && (current.remediation.length > 180 || current.remediation.includes(';')) && (
                      <button
                        onClick={() => setIsFixExpanded((v) => !v)}
                        className="mt-2 text-[0.8rem] font-bold bg-transparent border-0 cursor-pointer px-0 py-0 transition-opacity duration-150 hover:opacity-80 flex items-center gap-1"
                        style={{ color: 'var(--fix-icon-color)' }}
                      >
                        <span>{isFixExpanded ? 'Show less' : 'Read more'}</span>
                        <span className="text-[0.75rem]">{isFixExpanded ? '▲' : '▼'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No official fix recorded yet.</p>
            )}
          </section>

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          {/* Affected Components */}
          <section className="mb-[22px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--text-muted)' }}>
                AFFECTED COMPONENTS {current.affectedComponents?.length > 0 && `(${current.affectedComponents.length})`}
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddComponent}
                  className="px-2.5 py-1 rounded-[6px] text-xs font-semibold border cursor-pointer transition-all flex items-center gap-1.5"
                  style={{ borderColor: 'var(--border-input)', background: 'var(--bg-badge)', color: 'var(--accent-blue)' }}
                >
                  <PlusIcon />
                  <span>Add Component</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-2.5">
                {editAffectedComponents.length === 0 ? (
                  <p className="text-xs italic text-center py-3 border rounded-[8px]" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>
                    No affected components added yet. Click "+ Add Component" above.
                  </p>
                ) : (
                  <div className="border rounded-[10px] overflow-x-auto p-2 max-h-[360px]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                    <table className="w-full min-w-[520px] border-collapse text-[0.84rem]">
                      <thead style={{ background: 'var(--bg-table-head)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th className="px-2 py-2 text-left text-[0.72rem] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Component</th>
                          <th className="px-2 py-2 text-left text-[0.72rem] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Versions</th>
                          <th className="px-2 py-2 text-left text-[0.72rem] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Instance</th>
                          <th className="px-2 py-2 text-left text-[0.72rem] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Status</th>
                          <th className="px-2 py-2 text-center text-[0.72rem] font-bold uppercase w-10" style={{ color: 'var(--text-muted)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editAffectedComponents.map((comp, i) => (
                          <tr key={i} className="border-t" style={{ borderColor: 'var(--border-color)' }}>
                            <td className="p-1.5">
                              <input
                                type="text"
                                maxLength={100}
                                value={comp.component}
                                onChange={(e) => handleUpdateComponent(i, 'component', e.target.value)}
                                placeholder="e.g. requests"
                                className="w-full px-2 py-1 rounded text-xs font-semibold"
                                style={baseEditableStyle}
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                maxLength={100}
                                value={comp.affectedVersions}
                                onChange={(e) => handleUpdateComponent(i, 'affectedVersions', e.target.value)}
                                placeholder="e.g. < 2.31.0"
                                className="w-full px-2 py-1 rounded text-xs"
                                style={baseEditableStyle}
                              />
                            </td>
                            <td className="p-1.5">
                              <input
                                type="text"
                                maxLength={100}
                                value={comp.instance}
                                onChange={(e) => handleUpdateComponent(i, 'instance', e.target.value)}
                                placeholder="e.g. Prod cluster"
                                className="w-full px-2 py-1 rounded text-xs"
                                style={baseEditableStyle}
                              />
                            </td>
                            <td className="p-1.5">
                              <select
                                value={comp.status || 'VULNERABLE'}
                                onChange={(e) => handleUpdateComponent(i, 'status', e.target.value)}
                                className="w-full px-2 py-1 rounded text-xs font-bold"
                                style={baseEditableStyle}
                              >
                                <option value="VULNERABLE">VULNERABLE</option>
                                <option value="PATCHED">PATCHED</option>
                              </select>
                            </td>
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveComponent(i)}
                                className="w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer text-red-500 hover:bg-red-500/10 mx-auto"
                                title="Remove component"
                              >
                                <TrashIcon />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : current.affectedComponents && current.affectedComponents.length > 0 ? (
              <div>
                <div
                  className={`border rounded-[10px] overflow-x-auto ${isComponentsExpanded && current.affectedComponents.length > 8 ? 'max-h-[380px] overflow-y-auto' : ''}`}
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <table className="w-full min-w-[480px] border-collapse text-[0.875rem]">
                    <thead style={{ background: 'var(--bg-table-head)', position: isComponentsExpanded && current.affectedComponents.length > 8 ? 'sticky' : 'static', top: 0, zIndex: 1 }}>
                      <tr>
                        {['Component', 'Affected Versions', 'Instance', 'Status'].map((h) => (
                          <th key={h} className="px-3.5 py-2.5 text-left text-[0.78rem] font-semibold border-b whitespace-nowrap" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-color)', background: 'var(--bg-table-head)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(isComponentsExpanded ? current.affectedComponents : current.affectedComponents.slice(0, 3)).map((comp, i) => (
                        <tr key={i} style={{ background: i % 2 === 1 ? 'var(--bg-table-alt)' : 'var(--bg-table-row)' }}>
                          <td className="px-3.5 py-3 border-b last:border-b-0 font-semibold text-[0.84rem] max-w-[160px] truncate" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', fontFamily: "'SF Mono','Fira Code',monospace" }} title={comp.component}>{comp.component}</td>
                          <td className="px-3.5 py-3 border-b last:border-b-0 align-middle max-w-[180px] truncate" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} title={comp.affectedVersions}>{comp.affectedVersions}</td>
                          <td className="px-3.5 py-3 border-b last:border-b-0 align-middle max-w-[150px] truncate" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} title={comp.instance}>{comp.instance}</td>
                          <td className="px-3.5 py-3 border-b last:border-b-0 align-middle whitespace-nowrap" style={{ borderColor: 'var(--border-color)' }}><StatusBadge status={comp.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {current.affectedComponents.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsComponentsExpanded((v) => !v)}
                    className="mt-2.5 w-full py-2 px-3 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer"
                    style={{
                      borderColor: 'var(--border-color)',
                      background: 'var(--bg-badge)',
                      color: 'var(--accent-blue)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-blue-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-badge)';
                    }}
                  >
                    <span>
                      {isComponentsExpanded
                        ? 'Show less'
                        : `Show all ${current.affectedComponents.length} components (${current.affectedComponents.length - 3} more)`}
                    </span>
                    <span className="text-[0.75rem]">{isComponentsExpanded ? '▲' : '▼'}</span>
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No affected components specified.</p>
            )}
          </section>

          <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />

          {/* References */}
          <section className="mb-[22px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[0.72rem] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--text-muted)' }}>
                REFERENCES {current.references?.length > 0 && `(${current.references.length})`}
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddReference}
                  className="px-2.5 py-1 rounded-[6px] text-xs font-semibold border cursor-pointer transition-all flex items-center gap-1.5"
                  style={{ borderColor: 'var(--border-input)', background: 'var(--bg-badge)', color: 'var(--accent-blue)' }}
                >
                  <PlusIcon />
                  <span>Add Reference</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {editReferences.length === 0 ? (
                  <p className="text-xs italic text-center py-3 border rounded-[8px]" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>
                    No reference links added yet. Click "+ Add Reference" above.
                  </p>
                ) : (
                  editReferences.map((ref, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-[10px] border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                      <input
                        type="text"
                        maxLength={100}
                        value={ref.name}
                        onChange={(e) => handleUpdateReference(i, 'name', e.target.value)}
                        placeholder="Reference Name (e.g. NVD CVE)"
                        className="w-1/3 px-3 py-1.5 rounded text-xs font-semibold"
                        style={baseEditableStyle}
                      />
                      <input
                        type="text"
                        maxLength={300}
                        value={ref.url}
                        onChange={(e) => handleUpdateReference(i, 'url', e.target.value)}
                        placeholder="URL (e.g. https://nvd.nist.gov/...)"
                        className="flex-1 px-3 py-1.5 rounded text-xs"
                        style={baseEditableStyle}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveReference(i)}
                        className="w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer text-red-500 hover:bg-red-500/10 flex-shrink-0"
                        title="Remove reference link"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : current.references && current.references.length > 0 ? (
              <div>
                <div
                  className={`flex flex-col gap-2.5 ${isReferencesExpanded && current.references.length > 8 ? 'max-h-[350px] overflow-y-auto pr-1' : ''}`}
                >
                  {(isReferencesExpanded ? current.references : current.references.slice(0, 3)).map((ref, i) => {
                    const targetUrl = ref.url.startsWith('http') ? ref.url : `https://${ref.url}`;
                    return (
                      <a key={i} href={targetUrl} target="_blank" rel="noopener noreferrer" id={`ref-link-${i}`}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-[10px] border no-underline transition-all duration-200"
                        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.background = 'var(--accent-blue-light)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}>
                        <span className="flex flex-shrink-0" style={{ color: 'var(--accent-blue)' }}><ExternalLinkIcon /></span>
                        <span className="text-[0.875rem] font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{ref.name || 'Reference'}</span>
                        <span className="text-[0.8rem] overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{ref.url}</span>
                      </a>
                    );
                  })}
                </div>
                {current.references.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setIsReferencesExpanded((v) => !v)}
                    className="mt-2.5 w-full py-2 px-3 rounded-[8px] border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer"
                    style={{
                      borderColor: 'var(--border-color)',
                      background: 'var(--bg-badge)',
                      color: 'var(--accent-blue)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--accent-blue-light)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--bg-badge)';
                    }}
                  >
                    <span>
                      {isReferencesExpanded
                        ? 'Show less'
                        : `Show all ${current.references.length} references (${current.references.length - 3} more)`}
                    </span>
                    <span className="text-[0.75rem]">{isReferencesExpanded ? '▲' : '▼'}</span>
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No reference links available.</p>
            )}
          </section>

          {/* User Suggestions / Fix Thread — hidden during edit and create mode */}
          {!isEditing && (
            <>
              <hr className="border-t mb-5 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />
              <FixThread
                fixes={fixes}
                onAddFix={handleAddFix}
                onEditFix={handleEditFix}
                onDeleteFix={handleDeleteFix}
              />
            </>
          )}
        </div>
      </aside>
    </>
  );
}

