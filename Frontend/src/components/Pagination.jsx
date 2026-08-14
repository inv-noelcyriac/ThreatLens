import React from 'react';

const ChevronIcon = ({ direction }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    {direction === 'left'
      ? <polyline points="15 18 9 12 15 6"/>
      : <polyline points="9 6 15 12 9 18"/>
    }
  </svg>
);

const btnBase = {
  borderColor: 'var(--border-input)',
  background: 'var(--bg-input)',
  color: 'var(--text-secondary)',
};

const btnHover = {
  borderColor: 'var(--accent-blue)',
  color: 'var(--accent-blue)',
  background: 'var(--accent-blue-light)',
};

/** Calculates truncated page numbers array: initially 5 pages, then 3 pages forward */
function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, 5, '...'];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, currentPage + 2, currentPage + 3, '...'];
}

export default function Pagination({
  currentPage,
  totalPages,
  cardsPerPage = 6,
  onCardsPerPageChange,
  onPageChange,
}) {
  const pages = totalPages && totalPages > 1 ? getVisiblePages(currentPage, totalPages) : [];

  return (
    <nav className="flex items-center justify-center pt-11 pb-7 px-6" aria-label="Pagination">
      {/* Centered borderless pagination container */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap max-w-full">
        {/* Page navigation buttons */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            {/* Prev Button */}
            <button
              id="pagination-prev-btn"
              type="button"
              className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-[9px] border text-sm font-semibold cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none"
              style={btnBase}
              onMouseEnter={e => { if (!e.currentTarget.disabled) Object.assign(e.currentTarget.style, btnHover); }}
              onMouseLeave={e => { Object.assign(e.currentTarget.style, btnBase); }}
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronIcon direction="left" />
              <span>Prev</span>
            </button>

            {/* Page numbers with ellipsis */}
            <div className="flex items-center gap-1.5">
              {pages.map((p, idx) => {
                if (p === '...') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-9 h-[38px] flex items-center justify-center text-sm font-semibold select-none"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      …
                    </span>
                  );
                }

                const isActive = p === currentPage;

                return (
                  <button
                    key={p}
                    id={`pagination-page-${p}-btn`}
                    type="button"
                    className="min-w-[36px] h-[38px] px-2.5 rounded-[9px] border text-sm font-semibold cursor-pointer flex items-center justify-center transition-all duration-150 select-none"
                    style={
                      isActive
                        ? { background: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', color: '#ffffff', fontWeight: '700' }
                        : btnBase
                    }
                    onMouseEnter={e => { if (!isActive) Object.assign(e.currentTarget.style, { borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'var(--bg-input)' }); }}
                    onMouseLeave={e => { if (!isActive) Object.assign(e.currentTarget.style, btnBase); }}
                    onClick={() => onPageChange(p)}
                    aria-label={`Page ${p}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            <button
              id="pagination-next-btn"
              type="button"
              className="flex items-center gap-1.5 h-[38px] px-3.5 rounded-[9px] border text-sm font-semibold cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none"
              style={btnBase}
              onMouseEnter={e => { if (!e.currentTarget.disabled) Object.assign(e.currentTarget.style, btnHover); }}
              onMouseLeave={e => { Object.assign(e.currentTarget.style, btnBase); }}
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronIcon direction="right" />
            </button>
          </div>
        )}

        {/* Vertical divider line */}
        {totalPages > 1 && onCardsPerPageChange && (
          <div className="h-6 w-[1px] hidden sm:block mx-1" style={{ background: 'var(--border-color)' }} />
        )}

        {/* Cards per page dropdown selector */}
        {onCardsPerPageChange && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <label htmlFor="cards-per-page-select" className="font-semibold whitespace-nowrap">
              Per page:
            </label>
            <select
              id="cards-per-page-select"
              value={cardsPerPage}
              onChange={(e) => onCardsPerPageChange(Number(e.target.value))}
              className="h-[38px] px-2.5 rounded-[9px] border text-sm font-semibold cursor-pointer outline-none transition-all duration-150"
              style={{
                borderColor: 'var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-input)'; }}
            >
              {[6, 9, 12, 15].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </nav>
  );
}
