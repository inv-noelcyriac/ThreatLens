import { useState, useRef, useEffect } from 'react';
import CustomDatePicker, { parseISODate, toDateNum } from './CustomDatePicker';

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

const ChevronDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SEVERITIES = [
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

export const DEFAULT_ECOSYSTEM_OPTIONS = [
  'npm',
  'PyPI',
  'Maven',
  'Go',
  'Packagist',
  'Cargo',
  'NuGet',
  'RubyGems',
  'Linux',
  'GitHub Advisory',
  'WordPress',
];

export const DEFAULT_TECH_NAME_OPTIONS = [
  'react',
  'django',
  'openssl',
  'express',
  'spring_boot',
  'vue',
  'angular',
  'next.js',
  'fastapi',
  'flask',
  'postgres',
  'redis',
  'docker',
  'kubernetes',
  'log4j',
  'struts',
  'nginx',
  'apache',
];

export default function SearchBar({
  query,
  onQueryChange,
  isSearching = false,
  ecosystem = '',
  onEcosystemChange = () => { },
  techName = '',
  onTechNameChange = () => { },
  startDate = '',
  onStartDateChange = () => { },
  endDate = '',
  onEndDateChange = () => { },
  onSearch,
  onClear,
  selectedSeverities = [],
  activeSelectedSeverities = [],
  activeEcosystem = '',
  activeTechName = '',
  activeStartDate = '',
  activeEndDate = '',
  onToggleSeverity,
  onClearFilters,
  onClearEcosystem,
  onClearTechName,
  onClearStartDate,
  onClearEndDate,
  ecosystemOptions = DEFAULT_ECOSYSTEM_OPTIONS,
  techNameOptions = DEFAULT_TECH_NAME_OPTIONS,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [showEcoMenu, setShowEcoMenu] = useState(false);
  const [showTechMenu, setShowTechMenu] = useState(false);

  const pendingCount =
    selectedSeverities.length +
    (ecosystem.trim() ? 1 : 0) +
    (techName.trim() ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  const hasActiveFilters =
    (activeSelectedSeverities && activeSelectedSeverities.length > 0) ||
    Boolean(activeEcosystem && activeEcosystem.trim()) ||
    Boolean(activeTechName && activeTechName.trim()) ||
    Boolean(activeStartDate) ||
    Boolean(activeEndDate);

  const isApplied =
    pendingCount > 0 &&
    ecosystem.trim() === (activeEcosystem || '').trim() &&
    techName.trim() === (activeTechName || '').trim() &&
    startDate === (activeStartDate || '') &&
    endDate === (activeEndDate || '') &&
    JSON.stringify(selectedSeverities.slice().sort()) === JSON.stringify((activeSelectedSeverities || []).slice().sort());
  const isMaxReached = selectedSeverities.length >= 3;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowEcoMenu(false);
      setShowTechMenu(false);
      setShowFilters(false);
      onSearch();
    }
  };

  const filteredEcoOptions = ecosystemOptions.filter((opt) =>
    opt.toLowerCase().includes((ecosystem || '').toLowerCase())
  );
  const isEcoExactMatch = ecosystemOptions.some((opt) => opt.toLowerCase() === (ecosystem || '').trim().toLowerCase());

  const filteredTechOptions = techNameOptions.filter((opt) =>
    opt.toLowerCase().includes((techName || '').toLowerCase())
  );
  const isTechExactMatch = techNameOptions.some((opt) => opt.toLowerCase() === (techName || '').trim().toLowerCase());

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
            maxLength={100}
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
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-input)';
              e.currentTarget.style.boxShadow = 'none';
              if (!query.trim() && onClear) {
                onClear();
              }
            }}
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
            borderColor: showFilters ? 'var(--accent-blue)' : 'var(--border-input)',
            background: showFilters ? 'var(--accent-blue-light)' : 'var(--bg-input)',
            color: showFilters ? 'var(--accent-blue)' : 'var(--text-secondary)',
          }}
          onClick={() => setShowFilters((v) => !v)}
          aria-label="Toggle search filters"
          aria-expanded={showFilters}
          title="Filter by severity, ecosystem, tech name & date range"
        >
          <FilterIcon />
          {/* Filter count badge */}
          {pendingCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 text-white text-[0.625rem] font-extrabold min-w-[17px] h-[17px] px-[3px] rounded-full flex items-center justify-center leading-none border-2 transition-colors duration-200"
              style={{
                background: isApplied ? '#6b7280' : '#ef4444',
                borderColor: 'var(--bg-primary)',
              }}
              aria-label={`${pendingCount} filter${pendingCount > 1 ? 's' : ''} ${isApplied ? 'applied' : 'pending'}`}
              title={isApplied ? `${pendingCount} active filter${pendingCount > 1 ? 's' : ''} applied` : `${pendingCount} pending filter${pendingCount > 1 ? 's' : ''} (click Search to apply)`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        {/* Search button with fixed width & smooth transition */}
        <button
          id="search-btn"
          disabled={isSearching}
          className={`h-12 w-[120px] rounded-[10px] border-0 text-white text-[0.9375rem] font-semibold font-[inherit] flex-shrink-0 transition-all duration-300 flex items-center justify-center gap-2 sm:flex-none ${isSearching ? 'opacity-90 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-px active:translate-y-0'
            }`}
          style={{ background: 'var(--accent-blue)' }}
          onMouseEnter={e => { if (!isSearching) e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
          onMouseLeave={e => { if (!isSearching) e.currentTarget.style.background = 'var(--accent-blue)'; }}
          onClick={() => {
            if (isSearching) return;
            setShowEcoMenu(false);
            setShowTechMenu(false);
            setShowFilters(false);
            onSearch();
          }}
        >
          {isSearching ? (
            <span className="flex items-center gap-1.5 animate-fadeIn">
              <svg className="animate-spin h-4 w-4 text-white shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5"></circle>
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-[0.875rem]">Searching</span>
            </span>
          ) : (
            <span className="animate-fadeIn">Search</span>
          )}
        </button>
      </div>

      {/* ── Expandable Filter panel ── */}
      <div
        className={`overflow-hidden transition-all duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${showFilters
          ? 'max-h-[600px] opacity-100 mt-2.5 pointer-events-auto overflow-visible'
          : 'max-h-0 opacity-0 mt-0 pointer-events-none'
          }`}
        aria-hidden={!showFilters}
      >
        <div
          className="flex flex-col gap-3.5 px-[18px] py-[15px] rounded-[10px] border transition-colors duration-300 relative"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)', boxShadow: 'var(--shadow-sm)' }}
        >
          {/* Row 1: Custom Dark-Theme Dropdown / Text Filters for Ecosystem and Tech Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Ecosystem input with custom dropdown */}
            <div className="flex flex-col gap-1.5 relative">
              <label htmlFor="ecosystem-filter-input" className="text-[0.75rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Ecosystem
              </label>
              <div className="relative w-full flex items-center">
                <input
                  id="ecosystem-filter-input"
                  type="text"
                  value={ecosystem}
                  maxLength={50}
                  onChange={(e) => {
                    onEcosystemChange(e.target.value);
                    setShowEcoMenu(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowEcoMenu(true)}
                  onBlur={() => {
                    setTimeout(() => setShowEcoMenu(false), 200);
                    if (!ecosystem.trim() && onClearEcosystem) {
                      onClearEcosystem();
                    }
                  }}
                  placeholder="Select or type ecosystem..."
                  className={`w-full h-9 pl-3 ${ecosystem ? 'pr-[62px]' : 'pr-9'} rounded-[8px] border-[1.5px] text-[0.85rem] font-[inherit] outline-none transition-all duration-200`}
                  style={{
                    borderColor: ecosystem ? 'var(--accent-blue)' : 'var(--border-input)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                {/* Clear (×) button for Ecosystem */}
                {ecosystem && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (onClearEcosystem) onClearEcosystem();
                      else onEcosystemChange('');
                      setShowEcoMenu(false);
                    }}
                    className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-all duration-150 hover:scale-110"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-badge)' }}
                    title="Clear ecosystem filter"
                    aria-label="Clear ecosystem filter"
                  >
                    <XIcon />
                  </button>
                )}
                {/* Vertical line divider + pointer cursor down arrow button */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowEcoMenu((v) => !v)}
                  className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center cursor-pointer border-l bg-transparent transition-opacity duration-150 opacity-60 hover:opacity-100"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}
                  title="Click to view ecosystem options"
                  aria-label="Toggle ecosystem dropdown"
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {/* Custom styled dark dropdown menu */}
              {showEcoMenu && (filteredEcoOptions.length > 0 || (ecosystem.trim() && !isEcoExactMatch)) && (
                <div
                  className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-[8px] border py-1 shadow-lg transition-all duration-150"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-card)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {filteredEcoOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onEcosystemChange(opt);
                        setShowEcoMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[0.825rem] font-medium transition-colors duration-150 cursor-pointer flex items-center justify-between"
                      style={{
                        color: ecosystem === opt ? 'var(--accent-blue)' : 'var(--text-primary)',
                        background: ecosystem === opt ? 'var(--accent-blue-light)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-blue-light)';
                        e.currentTarget.style.color = 'var(--accent-blue)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = ecosystem === opt ? 'var(--accent-blue-light)' : 'transparent';
                        e.currentTarget.style.color = ecosystem === opt ? 'var(--accent-blue)' : 'var(--text-primary)';
                      }}
                    >
                      <span>{opt}</span>
                      {ecosystem === opt && <CheckIcon />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tech Name input with custom dropdown */}
            <div className="flex flex-col gap-1.5 relative">
              <label htmlFor="tech-name-filter-input" className="text-[0.75rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Technology Name
              </label>
              <div className="relative w-full flex items-center">
                <input
                  id="tech-name-filter-input"
                  type="text"
                  value={techName}
                  maxLength={50}
                  onChange={(e) => {
                    onTechNameChange(e.target.value);
                    setShowTechMenu(true);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowTechMenu(true)}
                  onBlur={() => {
                    setTimeout(() => setShowTechMenu(false), 200);
                    if (!techName.trim() && onClearTechName) {
                      onClearTechName();
                    }
                  }}
                  placeholder="Select or type technology..."
                  className={`w-full h-9 pl-3 ${techName ? 'pr-[62px]' : 'pr-9'} rounded-[8px] border-[1.5px] text-[0.85rem] font-[inherit] outline-none transition-all duration-200`}
                  style={{
                    borderColor: techName ? 'var(--accent-blue)' : 'var(--border-input)',
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                {/* Clear (×) button for Tech Name */}
                {techName && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (onClearTechName) onClearTechName();
                      else onTechNameChange('');
                      setShowTechMenu(false);
                    }}
                    className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full cursor-pointer transition-all duration-150 hover:scale-110"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-badge)' }}
                    title="Clear technology name filter"
                    aria-label="Clear technology name filter"
                  >
                    <XIcon />
                  </button>
                )}
                {/* Vertical line divider + pointer cursor down arrow button */}
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowTechMenu((v) => !v)}
                  className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center cursor-pointer border-l bg-transparent transition-opacity duration-150 opacity-60 hover:opacity-100"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}
                  title="Click to view technology options"
                  aria-label="Toggle technology dropdown"
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {/* Custom styled dark dropdown menu */}
              {showTechMenu && filteredTechOptions.length > 0 && (
                <div
                  className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-[8px] border py-1 shadow-lg transition-all duration-150"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-card)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {filteredTechOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onTechNameChange(opt);
                        setShowTechMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[0.825rem] font-medium transition-colors duration-150 cursor-pointer flex items-center justify-between"
                      style={{
                        color: techName === opt ? 'var(--accent-blue)' : 'var(--text-primary)',
                        background: techName === opt ? 'var(--accent-blue-light)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--accent-blue-light)';
                        e.currentTarget.style.color = 'var(--accent-blue)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = techName === opt ? 'var(--accent-blue-light)' : 'transparent';
                        e.currentTarget.style.color = techName === opt ? 'var(--accent-blue)' : 'var(--text-primary)';
                      }}
                    >
                      <span>{opt}</span>
                      {techName === opt && <CheckIcon />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Published Date Range Filter */}
          <div className="flex flex-col gap-1.5 pt-2.5 border-t" style={{ borderColor: 'var(--border-card)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Published Date Range
              </span>
              {startDate && endDate && toDateNum(startDate) > toDateNum(endDate) && (
                <span className="text-[0.7rem] font-bold text-red-400 flex items-center gap-1">
                  ⚠️ "From" date cannot be later than "To" date
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center w-full min-w-0">
              <div className="flex items-center gap-2 w-full min-w-0">
                <label htmlFor="start-date-input" className="text-[0.775rem] font-medium whitespace-nowrap shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  From:
                </label>
                <div className="flex-1 min-w-0 w-full">
                  <CustomDatePicker
                    id="start-date-input"
                    value={startDate}
                    onChange={(val) => {
                      if (!val) {
                        if (onClearStartDate) onClearStartDate();
                        else onStartDateChange('');
                      } else {
                        onStartDateChange(val);
                        if (endDate && toDateNum(val) > toDateNum(endDate)) {
                          onEndDateChange(val);
                        }
                      }
                    }}
                    maxDate={endDate || `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`}
                    disableFuture={true}
                    placeholder="DD-MM-YYYY"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full min-w-0">
                <label htmlFor="end-date-input" className="text-[0.775rem] font-medium whitespace-nowrap shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  To:
                </label>
                <div className="flex-1 min-w-0 w-full">
                  <CustomDatePicker
                    id="end-date-input"
                    value={endDate}
                    onChange={(val) => {
                      if (!val) {
                        if (onClearEndDate) onClearEndDate();
                        else onEndDateChange('');
                      } else {
                        onEndDateChange(val);
                        if (startDate && toDateNum(val) < toDateNum(startDate)) {
                          onStartDateChange(val);
                        }
                      }
                    }}
                    minDate={startDate}
                    maxDate={`${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`}
                    disableFuture={true}
                    placeholder="DD-MM-YYYY"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Severity Chips */}
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

            {(pendingCount > 0 || hasActiveFilters) && (
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
