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

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <nav className="flex flex-col items-center gap-3.5 pt-8 px-6" aria-label="Pagination">
      <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>
        Page {currentPage.toLocaleString()} of {totalPages.toLocaleString()}
      </span>

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
              className="w-9 h-9 rounded-[10px] border-[1.5px] text-[0.875rem] font-medium font-[inherit] cursor-pointer flex items-center justify-center transition-all duration-200"
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
    </nav>
  );
}
