const SortDescendingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="11" y2="6"/>
    <line x1="3" y1="12" x2="9" y2="12"/>
    <line x1="3" y1="18" x2="7" y2="18"/>
    <line x1="17" y1="5" x2="17" y2="19"/>
    <polyline points="13 15 17 19 21 15"/>
  </svg>
);

const SortAscendingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="11" y2="6"/>
    <line x1="3" y1="12" x2="9" y2="12"/>
    <line x1="3" y1="18" x2="7" y2="18"/>
    <line x1="17" y1="19" x2="17" y2="5"/>
    <polyline points="13 9 17 5 21 9"/>
  </svg>
);

export default function SortControls({ sortDir, onSortDirChange }) {
  const isDescending = sortDir === 'Descending';

  return (
    <div
      className="inline-flex items-center rounded-[10px] border-[1.5px] overflow-hidden select-none font-[inherit] h-[38px]"
      style={{
        borderColor: 'var(--border-input)',
        background: 'var(--bg-input)',
      }}
    >
      {/* Newest Segment */}
      <button
        id="sort-newest-btn"
        type="button"
        className="flex items-center gap-1.5 px-3.5 h-full text-[0.875rem] font-semibold border-0 border-r cursor-pointer transition-all duration-150"
        style={{
          borderColor: 'var(--border-input)',
          background: isDescending ? 'var(--bg-card)' : 'transparent',
          color: isDescending ? 'var(--text-heading)' : 'var(--text-muted)',
        }}
        onMouseEnter={(e) => {
          if (!isDescending) e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          if (!isDescending) e.currentTarget.style.color = 'var(--text-muted)';
        }}
        onClick={() => onSortDirChange('Descending')}
        aria-pressed={isDescending}
        aria-label="Sort by Newest"
      >
        <SortDescendingIcon />
        <span>Newest</span>
      </button>

      {/* Oldest Segment */}
      <button
        id="sort-oldest-btn"
        type="button"
        className="flex items-center gap-1.5 px-3.5 h-full text-[0.875rem] font-semibold border-0 cursor-pointer transition-all duration-150"
        style={{
          background: !isDescending ? 'var(--bg-card)' : 'transparent',
          color: !isDescending ? 'var(--text-heading)' : 'var(--text-muted)',
        }}
        onMouseEnter={(e) => {
          if (isDescending) e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          if (isDescending) e.currentTarget.style.color = 'var(--text-muted)';
        }}
        onClick={() => onSortDirChange('Ascending')}
        aria-pressed={!isDescending}
        aria-label="Sort by Oldest"
      >
        <SortAscendingIcon />
        <span>Oldest</span>
      </button>
    </div>
  );
}
