import React, { useState, useEffect, useRef } from 'react';

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

export function parseISODate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    } else {
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      y = parseInt(parts[2], 10);
    }
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

export function toDateNum(dateStr) {
  const dObj = parseISODate(dateStr);
  if (!dObj) return 0;
  const y = dObj.getFullYear();
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const d = String(dObj.getDate()).padStart(2, '0');
  return parseInt(`${y}${m}${d}`, 10);
}

export default function CustomDatePicker({
  id,
  value,
  onChange,
  placeholder = 'DD-MM-YYYY',
  minDate = '',
  maxDate = '',
  disableFuture = true,
  hasError = false,
  inputClassName = '',
  style = {},
  align = 'left',
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
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

  const maxYearChoice = disableFuture ? currentYear : Math.max(currentYear + 15, year + 5);
  const yearOptions = Array.from(
    { length: maxYearChoice - 2000 + 1 },
    (_, i) => 2000 + i
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const availableMonths = monthNames
    .map((name, idx) => ({ name, idx }))
    .filter(({ idx }) => {
      if (disableFuture && year >= currentYear) {
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
    if (!disableFuture || year < currentYear || (year === currentYear && month < currentMonth)) {
      setViewDate(new Date(year, month + 1, 1));
    }
  };

  const handleYearChange = (newYear) => {
    let targetMonth = month;
    if (disableFuture && newYear >= currentYear && targetMonth > currentMonth) {
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

  const gridCells = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    gridCells.push({
      year: month === 0 ? year - 1 : year,
      month: month === 0 ? 11 : month - 1,
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push({
      year,
      month,
      day: d,
      isCurrentMonth: true,
    });
  }

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

  const todayNum = parseInt(
    `${todayObj.getFullYear()}${String(todayObj.getMonth() + 1).padStart(2, '0')}${String(todayObj.getDate()).padStart(2, '0')}`,
    10
  );
  const todayFormatted = `${String(todayObj.getDate()).padStart(2, '0')}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${todayObj.getFullYear()}`;

  const minNum = minDate ? toDateNum(minDate) : 0;
  const maxNum = maxDate ? toDateNum(maxDate) : Infinity;

  const isNextDisabled = disableFuture && (year >= currentYear && month >= currentMonth);
  const popoverPositionClass = align === 'right' ? 'right-0 left-auto' : 'left-0 right-auto';

  const isDashed = style && style.borderStyle === 'dashed';

  const defaultInputStyle = {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    height: '36px',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: hasError ? '#ef4444' : (value ? 'var(--accent-blue)' : 'var(--border-input)'),
    background: 'var(--bg-input)',
    color: value ? 'var(--text-primary)' : 'var(--text-muted)',
    borderRadius: '8px',
  };

  const mergedInputStyle = {
    ...defaultInputStyle,
    ...style,
    ...(hasError ? { borderColor: '#ef4444' } : {}),
  };

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

  return (
    <div ref={containerRef} className="relative w-full flex-1 min-w-0">
      <div className="relative flex items-center w-full">
        <input
          id={id}
          type="text"
          readOnly
          value={value}
          onClick={() => setIsOpen((v) => !v)}
          onFocus={onFocus}
          onBlur={onBlur}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          placeholder={placeholder}
          className={`w-full px-3 pr-[64px] text-[0.825rem] font-semibold outline-none cursor-pointer transition-all ${inputClassName}`}
          style={mergedInputStyle}
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClear();
            }}
            className="absolute right-[40px] top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-[18px] h-[18px] rounded-full cursor-pointer transition-all duration-150 hover:scale-110"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-badge)' }}
            title="Clear date filter"
            aria-label="Clear date filter"
          >
            <XIcon />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen((v) => !v)}
          className={`absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center cursor-pointer bg-transparent opacity-60 hover:opacity-100 transition-opacity ${
            isDashed ? '' : 'border-l'
          }`}
          style={{
            borderColor: isDashed ? 'transparent' : (hasError ? '#ef4444' : (value ? 'var(--accent-blue)' : 'var(--border-input)')),
            color: 'var(--text-muted)',
          }}
          title="Toggle calendar"
        >
          <CalendarIcon />
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute z-50 ${popoverPositionClass} top-full mt-1.5 p-3.5 rounded-[10px] border shadow-lg w-[265px] animate-fade-in`}
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-primary)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
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

          <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell, idx) => {
              const mStr = String(cell.month + 1).padStart(2, '0');
              const dStr = String(cell.day).padStart(2, '0');
              const dateFormatted = `${dStr}-${mStr}-${cell.year}`;
              const dateNum = parseInt(`${cell.year}${mStr}${dStr}`, 10);

              const isSelected = value === dateFormatted;
              const isToday = todayFormatted === dateFormatted;

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
