const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const SwapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="7" y1="16" x2="7" y2="4"/>
    <polyline points="1 10 7 4 13 10"/>
    <line x1="17" y1="8" x2="17" y2="20"/>
    <polyline points="11 14 17 20 23 14"/>
  </svg>
);

const SORT_OPTIONS = ['Date', 'CVSS Score'];

export default function SortControls({ sortBy, sortDir, onSortByChange, onSortDirChange }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Sort-by select */}
      <div className="relative">
        <select
          id="sort-by-select"
          className="appearance-none h-[38px] pl-3.5 pr-9 rounded-[10px] border-[1.5px] text-[0.875rem] font-medium font-[inherit] cursor-pointer outline-none transition-all duration-200"
          style={{
            borderColor: 'var(--border-input)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          aria-label="Sort by"
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronDownIcon />
        </span>
      </div>

      {/* Sort direction button */}
      <button
        id="sort-dir-btn"
        className="flex items-center gap-1.5 h-[38px] px-4 rounded-[10px] border-[1.5px] text-[0.875rem] font-medium font-[inherit] cursor-pointer transition-all duration-200"
        style={{
          borderColor: 'var(--border-input)',
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent-blue)';
          e.currentTarget.style.color = 'var(--accent-blue)';
          e.currentTarget.style.background = 'var(--accent-blue-light)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-input)';
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.background = 'var(--bg-input)';
        }}
        onClick={() => onSortDirChange(sortDir === 'Descending' ? 'Ascending' : 'Descending')}
        aria-label={`Sort direction: ${sortDir}`}
      >
        <SwapIcon />
        <span>{sortDir}</span>
      </button>
    </div>
  );
}
