import { useState, useRef, useEffect } from 'react';

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

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function parseISODate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  let y, m, d;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    y = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    d = parseInt(parts[2], 10);
  } else {
    // DD-MM-YYYY
    d = parseInt(parts[0], 10);
    m = parseInt(parts[1], 10) - 1;
    y = parseInt(parts[2], 10);
  }
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m, d);
}

function toDateNum(dateStr) {
  const dObj = parseISODate(dateStr);
  if (!dObj) return 0;
  const y = dObj.getFullYear();
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const d = String(dObj.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);
}

function CustomDatePicker({
  id,
  value,
  onChange,
  placeholder = 'DD-MM-YYYY',
  minDate = '',
  maxDate = '',
  disableFuture = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const [viewDate, setViewDate] = useState(() => {
    return parseISODate(value) || new Date();
  });

  useEffect(() => {
    const parsed = parseISODate(value);
    if (parsed) setViewDate(parsed);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const todayObj = new Date();
  const currentYear = todayObj.getFullYear();
  const currentMonth = todayObj.getMonth();

  const yearOptions = Array.from(
    { length: Math.max(1, currentYear - 2000 + 1) },
    (_, i) => 2000 + i
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Restrict month list: if selected year is currentYear, only show months <= currentMonth
  const availableMonths = monthNames
    .map((name, idx) => ({ name, idx }))
    .filter(({ idx }) => {
      if (year >= currentYear) {
        return idx <= currentMonth;
      }
      return true;
    });

  const handlePrevMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      setViewDate(new Date(year, month + 1, 1));
    }
  };

  const handleYearChange = (newYear) => {
    let targetMonth = month;
    if (newYear >= currentYear && targetMonth > currentMonth) {
      targetMonth = currentMonth;
    }
    setViewDate(new Date(newYear, targetMonth, 1));
  };

  const handleSelectDay = (y, m, d) => {
    const dStr = String(d).padStart(2, '0');
    const mStr = String(m + 1).padStart(2, '0');
    const formatted = `${dStr}-${mStr}-${y}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    const formatted = `${dStr}-${mStr}-${y}`;
    setViewDate(today);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  // Build 35 or 42 grid cells including trailing/leading days
  const gridCells = [];

  // Trailing previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    gridCells.push({
      year: month === 0 ? year - 1 : year,
      month: month === 0 ? 11 : month - 1,
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push({
      year,
      month,
      day: d,
      isCurrentMonth: true,
    });
  }

  // Leading next month days
  const totalSlots = gridCells.length > 35 ? 42 : 35;
  const remaining = totalSlots - gridCells.length;
  for (let n = 1; n <= remaining; n++) {
    gridCells.push({
      year: month === 11 ? year + 1 : year,
      month: month === 11 ? 0 : month + 1,
      day: n,
      isCurrentMonth: false,
    });
  }

  // Today ISO & Formatted
  const todayNum = parseInt(
    `${todayObj.getFullYear()}${String(todayObj.getMonth() + 1).padStart(2, '0')}${String(todayObj.getDate()).padStart(2, '0')}`,
    10
  );
  const todayFormatted = `${String(todayObj.getDate()).padStart(2, '0')}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${todayObj.getFullYear()}`;

  const minNum = minDate ? toDateNum(minDate) : 0;
  const maxNum = maxDate ? toDateNum(maxDate) : Infinity;

  const isNextDisabled = year >= currentYear && month >= currentMonth;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full">
        <input
          id={id}
          type="text"
          readOnly
          value={value}
          onClick={() => setIsOpen((v) => !v)}
          placeholder={placeholder}
          className="w-full h-9 pl-3 pr-9 rounded-[8px] border-[1.5px] text-[0.825rem] font-[inherit] outline-none cursor-pointer transition-all duration-200"
          style={{
            borderColor: value ? 'var(--accent-blue)' : 'var(--border-input)',
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen((v) => !v)}
          className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center cursor-pointer border-l bg-transparent opacity-60 hover:opacity-100 transition-opacity"
          style={{ borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}
          title="Toggle calendar"
        >
          <CalendarIcon />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 right-0 sm:left-0 sm:right-auto top-full mt-1.5 p-3.5 rounded-[10px] border shadow-lg w-[265px] animate-fade-in"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Calendar Header: Month & Year Dropdown Selectors + Prev/Next buttons */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b" style={{ borderColor: 'var(--border-card)' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-[6px] cursor-pointer hover:bg-[var(--bg-badge)] transition-colors flex items-center justify-center"
              style={{ color: 'var(--text-secondary)' }}
              title="Previous month"
            >
              <ChevronLeftIcon />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Select Dropdown */}
              <select
                value={month}
                onChange={(e) => setViewDate(new Date(year, parseInt(e.target.value, 10), 1))}
                className="text-[0.8rem] font-bold outline-none cursor-pointer rounded-[6px] px-1.5 py-0.5 border transition-all"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-heading)',
                }}
              >
                {availableMonths.map(({ name, idx }) => (
                  <option key={name} value={idx} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Select Dropdown (Restricted up to currentYear) */}
              <select
                value={year}
                onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                className="text-[0.8rem] font-bold outline-none cursor-pointer rounded-[6px] px-1.5 py-0.5 border transition-all"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-heading)',
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={isNextDisabled}
              onClick={handleNextMonth}
              className={`p-1.5 rounded-[6px] transition-colors flex items-center justify-center ${
                isNextDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--bg-badge)]'
              }`}
              style={{ color: 'var(--text-secondary)' }}
              title="Next month"
            >
              <ChevronRightIcon />
            </button>
          </div>

          {/* Weekday headers: Sun to Sat */}
          <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell, idx) => {
              const mStr = String(cell.month + 1).padStart(2, '0');
              const dStr = String(cell.day).padStart(2, '0');
              const dateFormatted = `${dStr}-${mStr}-${cell.year}`;
              const dateNum = parseInt(`${cell.year}${mStr}${dStr}`, 10);

              const isSelected = value === dateFormatted;
              const isToday = todayFormatted === dateFormatted;

              // Validation rules using numeric date representation
              const isFuture = disableFuture && dateNum > todayNum;
              const isBeforeMin = minNum > 0 && dateNum < minNum;
              const isAfterMax = maxNum < Infinity && dateNum > maxNum;
              const isDisabled = isFuture || isBeforeMin || isAfterMax;

              return (
                <button
                  key={`${dateFormatted}-${idx}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && handleSelectDay(cell.year, cell.month, cell.day)}
                  className={`w-7 h-7 rounded-[6px] text-[0.775rem] font-semibold flex items-center justify-center transition-all duration-150 ${
                    isDisabled
                      ? 'opacity-20 cursor-not-allowed pointer-events-none'
                      : isSelected
                      ? 'shadow-sm cursor-pointer'
                      : 'cursor-pointer'
                  }`}
                  style={{
                    background: isSelected
                      ? 'var(--accent-blue)'
                      : isToday
                      ? 'var(--accent-blue-light)'
                      : 'transparent',
                    color: isSelected
                      ? '#ffffff'
                      : isDisabled
                      ? 'var(--text-muted)'
                      : isToday
                      ? 'var(--accent-blue)'
                      : cell.isCurrentMonth
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                    border: isToday && !isSelected ? '1px solid var(--accent-blue)' : 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !isDisabled) {
                      e.currentTarget.style.background = 'var(--accent-blue-light)';
                      e.currentTarget.style.color = 'var(--accent-blue)';
                      e.currentTarget.style.opacity = '1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isDisabled) {
                      e.currentTarget.style.background = isToday ? 'var(--accent-blue-light)' : 'transparent';
                      e.currentTarget.style.color = isToday
                        ? 'var(--accent-blue)'
                        : cell.isCurrentMonth
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)';
                      e.currentTarget.style.opacity = cell.isCurrentMonth || isSelected ? '1' : '0.4';
                    }
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t text-[0.75rem]" style={{ borderColor: 'var(--border-card)' }}>
            <button
              type="button"
              onClick={handleSelectToday}
              disabled={maxNum < Infinity && todayNum > maxNum}
              className={`font-semibold transition-colors ${maxNum < Infinity && todayNum > maxNum ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ color: 'var(--accent-blue)' }}
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="font-medium cursor-pointer transition-colors hover:underline"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const SEVERITIES = [
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

const ECOSYSTEM_OPTIONS = [
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

const TECH_NAME_OPTIONS = [
  'react',
  'django',
  'openssl',
  'express',
  'spring-boot',
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
  ecosystem = '',
  onEcosystemChange = () => {},
  techName = '',
  onTechNameChange = () => {},
  startDate = '',
  onStartDateChange = () => {},
  endDate = '',
  onEndDateChange = () => {},
  onSearch,
  onClear,
  selectedSeverities,
  onToggleSeverity,
  onClearFilters,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [showEcoMenu, setShowEcoMenu] = useState(false);
  const [showTechMenu, setShowTechMenu] = useState(false);

  const activeCount =
    selectedSeverities.length +
    (ecosystem.trim() ? 1 : 0) +
    (techName.trim() ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);
  const isMaxReached = selectedSeverities.length >= 3;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowEcoMenu(false);
      setShowTechMenu(false);
      onSearch();
    }
  };

  const filteredEcoOptions = ECOSYSTEM_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes((ecosystem || '').toLowerCase())
  );

  const filteredTechOptions = TECH_NAME_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes((techName || '').toLowerCase())
  );

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
          title="Filter by severity, ecosystem, tech name & date range"
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
          onClick={() => {
            setShowEcoMenu(false);
            setShowTechMenu(false);
            onSearch();
          }}
        >
          Search
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
                  onBlur={() => setTimeout(() => setShowEcoMenu(false), 200)}
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
                      onEcosystemChange('');
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
              {showEcoMenu && filteredEcoOptions.length > 0 && (
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
                Technology Name (tech_name)
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
                  onBlur={() => setTimeout(() => setShowTechMenu(false), 200)}
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
                      onTechNameChange('');
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="start-date-input" className="text-[0.775rem] font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  From:
                </label>
                <CustomDatePicker
                  id="start-date-input"
                  value={startDate}
                  onChange={(val) => {
                    onStartDateChange(val);
                    if (val && endDate && toDateNum(val) > toDateNum(endDate)) {
                      onEndDateChange(val);
                    }
                  }}
                  maxDate={endDate || `${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`}
                  disableFuture={true}
                  placeholder="DD-MM-YYYY"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="end-date-input" className="text-[0.775rem] font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                  To:
                </label>
                <CustomDatePicker
                  id="end-date-input"
                  value={endDate}
                  onChange={(val) => {
                    onEndDateChange(val);
                    if (val && startDate && toDateNum(val) < toDateNum(startDate)) {
                      onStartDateChange(val);
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
