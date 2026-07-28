import { useState } from 'react';

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SEVERITIES = [
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

export default function SearchBar({
  query,
  onQueryChange,
  ecosystem = '',
  onEcosystemChange = () => {},
  techName = '',
  onTechNameChange = () => {},
  onSearch,
  onClear,
  selectedSeverities,
  onToggleSeverity,
  onClearFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = selectedSeverities.length + (ecosystem.trim() ? 1 : 0) + (techName.trim() ? 1 : 0);
  const isMaxReached = selectedSeverities.length >= 3;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div className="max-w-[800px] mx-auto px-6 flex flex-col">
      {/* ── Main row ── */}
      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-full sm:min-w-0">
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none transition-colors duration-300"
            style={{ color: 'var(--text-muted)' }}
          >
            <SearchIcon />
          </span>
          <input
            id="vulnerability-search-input"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search CVEs, descriptions, titles..."
            aria-label="Search vulnerabilities"
            className={`w-full h-12 pl-[46px] ${query ? 'pr-10' : 'pr-4'} rounded-[10px] border-[1.5px] text-[0.9375rem] font-[inherit] outline-none transition-all duration-200`}
            style={{
              borderColor: 'var(--border-input)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {/* Clear (×) button */}
          {query && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full cursor-pointer transition-all duration-150 hover:scale-110"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-badge)' }}
              aria-label="Clear search"
            >
              <XIcon />
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          id="filter-btn"
          className="relative w-12 h-12 rounded-[10px] border-[1.5px] flex items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200"
          style={{
            borderColor: showFilters || activeCount > 0 ? 'var(--accent-blue)' : 'var(--border-input)',
            background: showFilters ? 'var(--accent-blue-light)' : 'var(--bg-input)',
            color: showFilters || activeCount > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)',
          }}
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Toggle search filters"
          aria-expanded={showFilters}
          title="Filter by severity, ecosystem & tech name"
        >
          <FilterIcon />
          {activeCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[0.625rem] font-extrabold min-w-[17px] h-[17px] px-[3px] rounded-full flex items-center justify-center leading-none border-2"
              style={{ borderColor: 'var(--bg-primary)' }}
              aria-label={`${activeCount} filter${activeCount > 1 ? 's' : ''} active`}
            >
              {activeCount}
            </span>
          )}
        </button>

        {/* Search button */}
        <button
          id="search-btn"
          className="h-12 px-7 rounded-[10px] border-0 text-white text-[0.9375rem] font-semibold font-[inherit] cursor-pointer flex-shrink-0 transition-all duration-200 hover:-translate-y-px active:translate-y-0 sm:flex-none flex-1"
          style={{ background: 'var(--accent-blue)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
          onClick={onSearch}
        >
          Search
        </button>
      </div>

      {/* ── Expandable Filter panel ── */}
      <div
        className={`overflow-hidden transition-all duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${showFilters
          ? 'max-h-[320px] opacity-100 mt-2.5 pointer-events-auto'
          : 'max-h-0 opacity-0 mt-0 pointer-events-none'
          }`}
        aria-hidden={!showFilters}
      >
        <div
          className="flex flex-col gap-3.5 px-[18px] py-[15px] rounded-[10px] border transition-colors duration-300"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)', boxShadow: 'var(--shadow-sm)' }}
        >
          {/* Row 1: Text Filters for Ecosystem and Tech Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ecosystem text input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ecosystem-filter-input" className="text-[0.75rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Ecosystem
              </label>
              <input
                id="ecosystem-filter-input"
                type="text"
                value={ecosystem}
                onChange={(e) => onEcosystemChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. npm, PyPI, Maven, Linux"
                className="w-full h-9 px-3 rounded-[8px] border-[1.5px] text-[0.85rem] font-[inherit] outline-none transition-all duration-200"
                style={{
                  borderColor: ecosystem ? 'var(--accent-blue)' : 'var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onBlur={e => { if (!ecosystem) e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              />
            </div>

            {/* Tech Name text input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tech-name-filter-input" className="text-[0.75rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Technology Name (tech_name)
              </label>
              <input
                id="tech-name-filter-input"
                type="text"
                value={techName}
                onChange={(e) => onTechNameChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. react, django, openssl"
                className="w-full h-9 px-3 rounded-[8px] border-[1.5px] text-[0.85rem] font-[inherit] outline-none transition-all duration-200"
                style={{
                  borderColor: techName ? 'var(--accent-blue)' : 'var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                onBlur={e => { if (!techName) e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              />
            </div>
          </div>

          {/* Row 2: Severity Chips */}
          <div className="flex items-center gap-3.5 pt-2.5 border-t flex-wrap" style={{ borderColor: 'var(--border-card)' }}>
            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.05em] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
              Severity
            </span>

            <div className="flex items-center gap-[7px] flex-wrap">
              {SEVERITIES.map(({ key, label }) => {
                const selected = selectedSeverities.includes(key);
                const disabled = !selected && isMaxReached;
                return (
                  <button
                    key={key}
                    id={`sev-filter-${key.toLowerCase()}`}
                    className={`sev-chip--${key.toLowerCase()} inline-flex items-center gap-[5px] px-[13px] py-[4px] rounded-[6px] text-[0.775rem] font-bold tracking-[0.03em] border-[1.5px] font-[inherit] transition-all duration-150 ${selected ? `sev-chip--selected` : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    style={selected ? undefined : {
                      borderColor: 'var(--border-input)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-secondary)',
                    }}
                    onClick={() => !disabled && onToggleSeverity(key)}
                    aria-pressed={selected}
                    disabled={disabled}
                    title={disabled ? 'Maximum 3 filters allowed' : undefined}
                  >
                    {selected && <span className="flex items-center"><CheckIcon /></span>}
                    {label}
                  </button>
                );
              })}
            </div>

            {activeCount > 0 && (
              <button
                id="clear-filters-btn"
                className="ml-auto text-[0.8125rem] font-semibold bg-transparent border-0 cursor-pointer font-[inherit] px-0.5 py-1 transition-opacity duration-150 hover:opacity-70 hover:underline"
                style={{ color: 'var(--accent-blue)' }}
                onClick={onClearFilters}
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
