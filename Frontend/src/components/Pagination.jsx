import { useState } from 'react';

const ChevronIcon = ({ direction }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

/** Calculates truncated page numbers array with ellipsis for clean navigation */
function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function Pagination({
  currentPage,
  totalPages,
  cardsPerPage = 6,
  onCardsPerPageChange,
  onPageChange,
}) {
  const [jumpPage, setJumpPage] = useState('');
  const pages = totalPages && totalPages > 1 ? getVisiblePages(currentPage, totalPages) : [];

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpPage('');
    }
  };

  return (
    <nav className="flex flex-col items-center gap-3.5 pt-8 px-6" aria-label="Pagination">
      <div className="flex items-center gap-4 flex-wrap justify-center">
        {totalPages && totalPages > 1 && (
          <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
            Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
          </span>
        )}

        {/* Cards per page dropdown selector */}
        {onCardsPerPageChange && (
          <div className="flex items-center gap-2 text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
            <label htmlFor="cards-per-page-select" className="font-medium whitespace-nowrap">
              Cards per page:
            </label>
            <select
              id="cards-per-page-select"
              value={cardsPerPage}
              onChange={(e) => onCardsPerPageChange(Number(e.target.value))}
              className="h-8 px-2.5 rounded-[8px] border-[1.5px] text-[0.8125rem] font-semibold cursor-pointer outline-none transition-all duration-150"
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

        {/* Direct "Go to page" input box */}
        {totalPages && totalPages > 1 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
            <label htmlFor="jump-to-page-input" className="font-medium whitespace-nowrap">
              Go to page:
            </label>
            <input
              id="jump-to-page-input"
              type="number"
              min="1"
              max={totalPages}
              placeholder="#"
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              className="h-8 min-w-[52px] px-2 text-center rounded-[8px] border-[1.5px] text-[0.8125rem] font-semibold outline-none transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{
                width: `${Math.max(52, (jumpPage ? jumpPage.length : 1) * 10 + 32)}px`,
                borderColor: jumpPage ? 'var(--accent-blue)' : 'var(--border-input)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = jumpPage ? 'var(--accent-blue)' : 'var(--border-input)'; }}
            />
            <button
              type="submit"
              disabled={!jumpPage || parseInt(jumpPage, 10) < 1 || parseInt(jumpPage, 10) > totalPages}
              className="h-8 px-2.5 rounded-[8px] border-[1.5px] text-[0.775rem] font-semibold cursor-pointer transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: 'var(--accent-blue)',
                background: 'var(--accent-blue)',
                color: '#ffffff',
              }}
            >
              Go
            </button>
          </form>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {/* Prev Button */}
          <button
            id="pagination-prev-btn"
            className="flex items-center gap-[5px] h-9 px-3.5 rounded-[10px] border-[1.5px] text-[0.875rem] font-medium font-[inherit] cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-9 h-9 flex items-center justify-center text-[0.875rem] font-medium select-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  …
                </span>
              );
            }

            return (
              <button
                key={p}
                id={`pagination-page-${p}-btn`}
                className="min-w-[36px] h-9 px-2.5 rounded-[10px] border-[1.5px] text-[0.875rem] font-medium font-[inherit] cursor-pointer flex items-center justify-center transition-all duration-200"
                style={
                  p === currentPage
                    ? { background: 'var(--accent-blue)', borderColor: 'var(--accent-blue)', color: '#ffffff', fontWeight: '600' }
                    : btnBase
                }
                onMouseEnter={e => { if (p !== currentPage) Object.assign(e.currentTarget.style, { borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)', background: 'var(--bg-input)' }); }}
                onMouseLeave={e => { if (p !== currentPage) Object.assign(e.currentTarget.style, btnBase); }}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={p === currentPage ? 'page' : undefined}
              >
                {p}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            id="pagination-next-btn"
            className="flex items-center gap-[5px] h-9 px-3.5 rounded-[10px] border-[1.5px] text-[0.875rem] font-medium font-[inherit] cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
    </nav>
  );
}
