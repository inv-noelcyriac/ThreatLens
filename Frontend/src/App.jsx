import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchBar from './components/SearchBar';
import SortControls from './components/SortControls';
import VulnCard from './components/VulnCard';
import Pagination from './components/Pagination';
import DetailPanel from './components/DetailPanel';
import { fetchVulnerabilities } from './services/api';

const CARDS_PER_PAGE = 6;

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('threatlens-theme') || 'dark');
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [ecosystem, setEcosystem] = useState('');
  const [activeEcosystem, setActiveEcosystem] = useState('');
  const [techName, setTechName] = useState('');
  const [activeTechName, setActiveTechName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [activeStartDate, setActiveStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeEndDate, setActiveEndDate] = useState('');
  const [cardsPerPage, setCardsPerPage] = useState(6);
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [sortBy, setSortBy] = useState('Date');
  const [sortDir, setSortDir] = useState('Descending');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVuln, setSelectedVuln] = useState(null);

  // API Data State
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

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

  // API 1: Fetch list with query parameters
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setApiError(null);

    fetchVulnerabilities({
      page: currentPage,
      limit: cardsPerPage,
      query: activeQuery,
      ecosystem: activeEcosystem,
      tech_name: activeTechName,
      startDate: activeStartDate,
      endDate: activeEndDate,
      severities: selectedSeverities,
      sortBy,
      sortDir,
    })
      .then((res) => {
        if (!isMounted) return;
        setVulnerabilities(res.results);
        setTotalCount(res.count);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('API 1 Search error:', err);
        setApiError(err.message || 'Failed to fetch vulnerabilities from Django backend');
        setVulnerabilities([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeQuery, activeEcosystem, activeTechName, activeStartDate, activeEndDate, selectedSeverities, currentPage, cardsPerPage, sortBy, sortDir, retryTrigger]);

  const handleSearch = () => {
    setActiveQuery(query.trim());
    setActiveEcosystem(ecosystem.trim());
    setActiveTechName(techName.trim());
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
    setCurrentPage(1);
  };

  // Clear search bar and reset query results immediately
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

  const handleClearFilters = () => {
    setSelectedSeverities([]);
    setEcosystem('');
    setActiveEcosystem('');
    setTechName('');
    setActiveTechName('');
    setStartDate('');
    setActiveStartDate('');
    setEndDate('');
    setActiveEndDate('');
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / cardsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  // Automatically reset currentPage if search/filter shrinks totalPages below currentPage
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  };

  const handleCardsPerPageChange = (newLimit) => {
    setCardsPerPage(newLimit);
    setCurrentPage(1);
  };

  const handleToggleTheme = () => {
    const html = document.documentElement;
    html.classList.add('theme-transitioning');
    setTheme(t => t === 'dark' ? 'light' : 'dark');
    setTimeout(() => html.classList.remove('theme-transitioning'), 400);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header theme={theme} onToggleTheme={handleToggleTheme} />

      <main className="flex-1 pb-12" style={{ background: 'var(--main-bg, transparent)' }}>
        <Hero totalCount={totalCount} />

        <div className="max-w-[1200px] mx-auto pt-4 flex flex-col gap-3.5">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            ecosystem={ecosystem}
            onEcosystemChange={setEcosystem}
            techName={techName}
            onTechNameChange={setTechName}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
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

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-6">
            <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Querying vulnerabilities API...</p>
          </div>
        ) : apiError ? (
          <div
            className="max-w-[560px] mx-auto my-14 p-8 rounded-[16px] border text-center flex flex-col items-center gap-3.5 shadow-sm"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-card)',
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'var(--sev-medium-bg)', color: 'var(--sev-medium-text)' }}
            >
              📡
            </div>
            <h3 className="text-[1.1rem] font-semibold" style={{ color: 'var(--text-heading)' }}>
              Service Temporarily Unavailable
            </h3>
            <p className="text-[0.875rem] max-w-[440px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              We're having trouble connecting to the ThreatLens security database right now. Please check your network connection or try again in a few moments.
            </p>
            <button
              onClick={() => {
                setApiError(null);
                setIsLoading(true);
                setRetryTrigger(c => c + 1);
              }}
              className="mt-1 px-5 py-2.5 rounded-[10px] text-[0.875rem] font-semibold cursor-pointer transition-all duration-200 border-0"
              style={{
                background: 'var(--accent-blue)',
                color: '#ffffff',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
            >
              Retry Connection
            </button>
          </div>
        ) : vulnerabilities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center"
            style={{ color: 'var(--text-secondary)' }}>
            <span className="text-4xl">🔍</span>
            <p className="text-base">No vulnerabilities match current query parameters</p>
            <button
              className="mt-1 px-5 py-2 rounded-[10px] border-[1.5px] text-sm font-semibold cursor-pointer transition-all duration-200"
              style={{ borderColor: 'var(--border-input)', background: 'var(--bg-input)', color: 'var(--accent-blue)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}
              onClick={handleClearFilters}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="max-w-[1200px] mx-auto mt-6 px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
                {vulnerabilities.map((vuln, idx) => (
                  <VulnCard key={vuln.uuid || vuln.id || `vuln-${idx}`} vuln={vuln} onClick={setSelectedVuln} activeQuery={activeQuery} />
                ))}
              </div>
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              cardsPerPage={cardsPerPage}
              onCardsPerPageChange={handleCardsPerPageChange}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </main>

      <footer
        className="text-center px-6 py-5 text-[0.8125rem] border-t mt-auto transition-colors duration-300"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
      >
        ThreatLens · Backend API v1 Integration (`/api/v1/vulnerabilities/`)
      </footer>

      {selectedVuln && (
        <DetailPanel vuln={selectedVuln} onClose={() => setSelectedVuln(null)} />
      )}
    </div>
  );
}
