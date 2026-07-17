import { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchBar from './components/SearchBar';
import SortControls from './components/SortControls';
import VulnCard from './components/VulnCard';
import Pagination from './components/Pagination';
import DetailPanel from './components/DetailPanel';
import { vulnerabilities as allVulns } from './data/vulnerabilities';

const CARDS_PER_PAGE = 6;

function parseDate(dateStr) {
  const parts = dateStr.split(' ');
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  return new Date(Number(parts[2]), months[parts[1]], Number(parts[0]));
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('threatlens-theme') || 'dark');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [sortBy, setSortBy] = useState('Date');
  const [sortDir, setSortDir] = useState('Descending');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVuln, setSelectedVuln] = useState(null);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('threatlens-theme', theme);
  }, [theme]);

  // Lock body scroll when detail panel is open
  useEffect(() => {
    document.body.style.overflow = selectedVuln ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedVuln]);

  const handleSearch = () => { setActiveQuery(query.trim()); setCurrentPage(1); };

  // Clear search bar and reset results immediately
  const handleClear = () => {
    setQuery('');
    setActiveQuery('');
    setCurrentPage(1);
  };

  // Max 3 severity filters
  const handleToggleSeverity = (sev) => {
    setSelectedSeverities((prev) => {
      if (prev.includes(sev)) {
        setCurrentPage(1);
        return prev.filter(s => s !== sev);
      }
      if (prev.length >= 3) return prev; // silently cap at 3
      setCurrentPage(1);
      return [...prev, sev];
    });
  };

  const handleClearFilters = () => { setSelectedSeverities([]); setCurrentPage(1); };

  // Filter
  const filtered = useMemo(() => {
    const q = activeQuery.toLowerCase();
    return allVulns.filter((v) => {
      const matchesQuery = !q || (
        v.id.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.ecosystem.toLowerCase().includes(q) ||
        v.source.toLowerCase().includes(q) ||
        v.severity.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
      );
      const matchesSeverity = selectedSeverities.length === 0 || selectedSeverities.includes(v.severity);
      return matchesQuery && matchesSeverity;
    });
  }, [activeQuery, selectedSeverities]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'Descending' ? -1 : 1;
    arr.sort((a, b) => {
      if (sortBy === 'Date') return dir * (parseDate(b.date) - parseDate(a.date));
      if (sortBy === 'CVSS Score') return dir * (b.cvss - a.cvss);
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / CARDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safePage - 1) * CARDS_PER_PAGE, safePage * CARDS_PER_PAGE);

  // No scroll-to-top on page change
  const handlePageChange = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header theme={theme} onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />

      <main className="flex-1 pb-12">
        <Hero totalCount={allVulns.length} />

        <div className="max-w-[1200px] mx-auto pt-6 flex flex-col gap-3.5">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            onClear={handleClear}
            selectedSeverities={selectedSeverities}
            onToggleSeverity={handleToggleSeverity}
            onClearFilters={handleClearFilters}
          />

          <div className="px-6">
            <SortControls
              sortBy={sortBy}
              sortDir={sortDir}
              onSortByChange={(v) => { setSortBy(v); setCurrentPage(1); }}
              onSortDirChange={(v) => { setSortDir(v); setCurrentPage(1); }}
            />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center"
            style={{ color: 'var(--text-secondary)' }}>
            <span className="text-4xl">🔍</span>
            <p className="text-base">No vulnerabilities match current filters</p>
            <button
              className="mt-1 px-5 py-2 rounded-[10px] border-[1.5px] text-sm font-semibold cursor-pointer transition-all duration-200"
              style={{ borderColor: 'var(--border-input)', background: 'var(--bg-input)', color: 'var(--accent-blue)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              onClick={() => { setQuery(''); setActiveQuery(''); setSelectedSeverities([]); }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="max-w-[1200px] mx-auto mt-6 px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                {paginated.map((vuln) => (
                  <VulnCard key={vuln.id} vuln={vuln} onClick={setSelectedVuln} activeQuery={activeQuery} />
                ))}
              </div>
            </div>
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </main>

      <footer
        className="text-center px-6 py-5 text-[0.8125rem] border-t mt-auto transition-colors duration-300"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
      >
        ThreatLens · Curated software vulnerability index · Data for demonstration purposes
      </footer>

      {selectedVuln && (
        <DetailPanel vuln={selectedVuln} onClose={() => setSelectedVuln(null)} />
      )}
    </div>
  );
}
