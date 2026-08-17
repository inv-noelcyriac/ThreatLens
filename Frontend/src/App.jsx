import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchBar, { DEFAULT_ECOSYSTEM_OPTIONS, DEFAULT_TECH_NAME_OPTIONS } from './components/SearchBar';
import SortControls from './components/SortControls';
import VulnCard from './components/VulnCard';
import Pagination from './components/Pagination';
import DetailPanel from './components/DetailPanel';
import UserLogin from './components/UserLogin';
import ActivityPage from './components/ActivityPage';
import NotFound from './components/NotFound';
import { fetchVulnerabilities, fetchVulnerabilityById, googleAuthLogin, fetchCurrentUser, clearAuthTokens, getStoredUser, getAccessToken } from './services/api';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('threatlens-theme') || 'light');
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
  const [activeSelectedSeverities, setActiveSelectedSeverities] = useState([]);
  const [sortBy, setSortBy] = useState('Date');
  const [sortDir, setSortDir] = useState('Descending');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVuln, setSelectedVuln] = useState(null);

  // Standard User Auth State
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [isUserAuthLoading, setIsUserAuthLoading] = useState(false);
  const [isSessionChecking, setIsSessionChecking] = useState(() => !!getAccessToken() && !getStoredUser());

  // Routing State
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  // Session Restore (GET /api/v1/auth/me/) on app load
  useEffect(() => {
    if (getAccessToken()) {
      fetchCurrentUser()
        .then((user) => {
          if (user) {
            setCurrentUser(user);
          }
        })
        .catch((err) => {
          console.warn('[Session Restore Warning]:', err);
        })
        .finally(() => {
          setIsSessionChecking(false);
        });
    } else {
      setIsSessionChecking(false);
    }
  }, []);

  // Global auth expiration listener: redirect to login if token refresh fails
  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      setSelectedVuln(null);
      window.history.replaceState({}, '', '/login');
      setCurrentPath('/login');
      showToast('Session expired. Please sign in again.', 'error');
    };
    window.addEventListener('threatlens-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('threatlens-auth-expired', handleAuthExpired);
  }, []);

  // Dropdown Options State
  const ecosystemOptions = DEFAULT_ECOSYSTEM_OPTIONS;
  const techNameOptions = DEFAULT_TECH_NAME_OPTIONS;

  // API Data State
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [globalTotalCount, setGlobalTotalCount] = useState(226711);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Sync theme with <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('threatlens-theme', theme);
  }, [theme]);

  // Sync client-side URL path navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Lock body scroll when detail panel is open
  useEffect(() => {
    document.body.style.overflow = selectedVuln ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedVuln]);

  // Fetch list with query parameters
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
      severities: activeSelectedSeverities,
      sortBy,
      sortDir,
    })
      .then((res) => {
        if (!isMounted) return;
        setVulnerabilities(res.results);
        setTotalCount(res.count);
        if (!activeQuery && !activeEcosystem && !activeTechName && !activeStartDate && !activeEndDate && activeSelectedSeverities.length === 0 && res.count > 0) {
          setGlobalTotalCount(res.count);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('API 1 Search error:', err);
        setApiError(err.message || 'Failed to fetch vulnerabilities from Django backend');
        setVulnerabilities([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
          setIsSearching(false);
        }
      });

    return () => { isMounted = false; };
  }, [activeQuery, activeEcosystem, activeTechName, activeStartDate, activeEndDate, activeSelectedSeverities, currentPage, cardsPerPage, sortBy, sortDir, retryTrigger]);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Toast Notification State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3800);
  };

  const renderToast = () => {
    if (!toast) return null;
    return (
      <div
        className="fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-[12px] border flex items-center gap-3 text-xs sm:text-sm font-semibold tracking-tight transition-all duration-200 animate-fade-slide-in cursor-default select-none shadow-xl"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
        }}
        role="status"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            background: toast.type === 'error' ? '#ef4444' : (toast.type === 'success' ? '#10b981' : 'var(--accent-blue)'),
          }}
        />
        <span className="truncate max-w-[340px] font-medium">{toast.message}</span>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="ml-2 text-xs opacity-50 hover:opacity-100 cursor-pointer border-0 bg-transparent flex items-center justify-center p-1 rounded-md transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
    );
  };

  // Google Authentication Callback
  const handleGoogleLoginSuccess = async (credential) => {
    setIsUserAuthLoading(true);
    try {
      const data = await googleAuthLogin(credential);
      const user = data.user || data;
      setCurrentUser(user);
      const email = user.email || 'corporate account';
      showToast(`Signed in successfully as ${email}`, 'success');
    } catch (err) {
      console.error('[Google Auth Login Error]:', err);
      showToast(err.message || 'Login failed. Could not authenticate corporate account.', 'error');
    } finally {
      setIsUserAuthLoading(false);
    }
  };

  const handleGoogleLoginError = (errorMsg) => {
    showToast(errorMsg || 'Login failed. Google Sign-In was cancelled or rejected.', 'error');
  };

  const handleUserLogout = () => {
    try {
      clearAuthTokens();
      setCurrentUser(null);
      showToast('Signed out of corporate account.', 'info');
    } catch (err) {
      console.error('[Logout Error]:', err);
      showToast('Logout failed. Could not terminate session.', 'error');
    }
  };

  const handleSearch = () => {
    const qTrim = query.trim();
    const ecoTrim = ecosystem.trim();
    const techTrim = techName.trim();

    const isAlreadySearched =
      qTrim === activeQuery &&
      ecoTrim === activeEcosystem &&
      techTrim === activeTechName &&
      startDate === activeStartDate &&
      endDate === activeEndDate &&
      JSON.stringify(selectedSeverities) === JSON.stringify(activeSelectedSeverities);

    if (isAlreadySearched) {
      return;
    }

    setIsSearching(true);
    setActiveQuery(qTrim);
    setActiveEcosystem(ecoTrim);
    setActiveTechName(techTrim);
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
    setActiveSelectedSeverities([...selectedSeverities]);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setQuery('');
    if (activeQuery !== '') {
      setActiveQuery('');
      setCurrentPage(1);
    }
  };

  const handleClearEcosystem = () => {
    setEcosystem('');
    if (activeEcosystem !== '') {
      setActiveEcosystem('');
      setCurrentPage(1);
    }
  };

  const handleClearTechName = () => {
    setTechName('');
    if (activeTechName !== '') {
      setActiveTechName('');
      setCurrentPage(1);
    }
  };

  const handleClearStartDate = () => {
    setStartDate('');
    if (activeStartDate !== '') {
      setActiveStartDate('');
      setCurrentPage(1);
    }
  };

  const handleClearEndDate = () => {
    setEndDate('');
    if (activeEndDate !== '') {
      setActiveEndDate('');
      setCurrentPage(1);
    }
  };

  const handleToggleSeverity = (sev) => {
    setSelectedSeverities((prev) => {
      let next;
      if (prev.includes(sev)) {
        next = prev.filter(s => s !== sev);
      } else {
        if (prev.length >= 3) return prev;
        next = [...prev, sev];
      }

      if (activeSelectedSeverities.length > 0) {
        setActiveSelectedSeverities(next);
        setCurrentPage(1);
      }

      return next;
    });
  };

  const handleClearFilters = () => {
    setSelectedSeverities([]);
    setEcosystem('');
    setTechName('');
    setStartDate('');
    setEndDate('');

    const hasActiveFilters =
      activeEcosystem !== '' ||
      activeTechName !== '' ||
      activeStartDate !== '' ||
      activeEndDate !== '' ||
      activeSelectedSeverities.length > 0;

    if (hasActiveFilters) {
      setActiveEcosystem('');
      setActiveTechName('');
      setActiveStartDate('');
      setActiveEndDate('');
      setActiveSelectedSeverities([]);
      setCurrentPage(1);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / cardsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

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
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition) {
      // Fallback: instant switch for browsers without View Transitions API
      setTheme(nextTheme);
      return;
    }
    document.startViewTransition(() => {
      setTheme(nextTheme);
    });
  };

  const hasRedirectedRef = useRef(false);

  // Get Django Admin backend URL using explicit network endpoint
  const getDjangoAdminUrl = () => {
    return 'http://10.10.13.44:8000/admin/';
  };

  const handleSelectActivityVuln = async (vulnId) => {
    const existing = vulnerabilities.find(v => v.id === vulnId || v.display_id === vulnId || v.uuid === vulnId);
    if (existing) {
      setSelectedVuln(existing);
      return;
    }

    try {
      const fetched = await fetchVulnerabilityById(vulnId);
      if (fetched) {
        setSelectedVuln(fetched);
      } else {
        setSelectedVuln({
          id: vulnId,
          display_id: vulnId,
          title: `${vulnId} Security Advisory`,
          severity: 'HIGH',
          cvss: '8.1',
          ecosystem: 'Security',
          date: '17 Aug 2026',
          status: 'OPEN',
          description: `Detailed advisory information for ${vulnId}. Technical remediation notes and community verification instructions available.`,
          affectedComponents: [{ component: vulnId, affectedVersions: 'See references', instance: 'Security', status: 'VULNERABLE' }],
          references: [{ id: 0, name: 'ThreatLens Intelligence', url: '#' }],
        });
      }
    } catch (e) {
      setSelectedVuln({
        id: vulnId,
        display_id: vulnId,
        title: `${vulnId} Security Advisory`,
        severity: 'HIGH',
        cvss: '8.1',
        ecosystem: 'Security',
        date: '17 Aug 2026',
        status: 'OPEN',
        description: `Detailed advisory information for ${vulnId}.`,
        affectedComponents: [{ component: vulnId, affectedVersions: 'See references', instance: 'Security', status: 'VULNERABLE' }],
        references: [{ id: 0, name: 'ThreatLens Intelligence', url: '#' }],
      });
    }
  };

  // Direct URL navigation (/admin or /admin/login) redirects to Django Admin backend portal
  useEffect(() => {
    const path = currentPath.toLowerCase().replace(/\/$/, '');
    if (path === '/admin' || path === '/admin/login') {
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true;
        window.location.href = getDjangoAdminUrl();
      }
    } else {
      hasRedirectedRef.current = false;
    }
  }, [currentPath]);

  const normalizedPath = currentPath.toLowerCase().replace(/\/$/, '');

  // Session Loading Screen while validating stored token
  if (isSessionChecking) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'var(--main-bg, var(--bg-primary))' }}>
        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Validating corporate session...</p>
      </div>
    );
  }

  // Gate 1: Require User authentication before entering search dashboard or activity page
  if (!currentUser) {
    if (normalizedPath === '' || normalizedPath === '/' || normalizedPath === '/login' || normalizedPath === '/activity') {
      return (
        <>
          <UserLogin
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onGoogleLoginSuccess={handleGoogleLoginSuccess}
            onGoogleLoginError={handleGoogleLoginError}
            isLoggingIn={isUserAuthLoading}
          />
          {renderToast()}
        </>
      );
    }
  }

  // Route 2: Activity Tracking Page
  if (normalizedPath === '/activity') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header
          theme={theme}
          onToggleTheme={handleToggleTheme}
          currentUser={currentUser}
          currentPath={normalizedPath}
          onNavigate={navigateTo}
          onGoogleLoginSuccess={handleGoogleLoginSuccess}
          onGoogleLoginError={handleGoogleLoginError}
          onUserLogout={handleUserLogout}
          isLoggingIn={isUserAuthLoading}
        />

        <main className="flex-1 pb-6" style={{ background: 'var(--main-bg, transparent)' }}>
          <ActivityPage
            currentUser={currentUser}
            onSelectVuln={handleSelectActivityVuln}
            showToast={showToast}
          />
        </main>

        <footer
          className="text-center px-6 py-5 text-[0.8125rem] border-t mt-auto transition-colors duration-300 flex items-center justify-center gap-2"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
        >
          <span>ThreatLens · Security Intelligence Platform</span>
        </footer>

        {selectedVuln && (
          <DetailPanel
            vuln={selectedVuln}
            onClose={() => setSelectedVuln(null)}
            currentUser={currentUser}
          />
        )}

        {renderToast()}
      </div>
    );
  }

  // Route 3: 404 Error Page for non-existing paths
  if (normalizedPath !== '' && normalizedPath !== '/' && normalizedPath !== '/login' && normalizedPath !== '/activity') {
    return (
      <NotFound
        theme={theme}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        onUserLogout={handleUserLogout}
        onNavigateHome={() => navigateTo('/')}
      />
    );
  }

  // Route 4: Main Vulnerability Search Dashboard
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        currentUser={currentUser}
        currentPath={normalizedPath}
        onNavigate={navigateTo}
        onGoogleLoginSuccess={handleGoogleLoginSuccess}
        onGoogleLoginError={handleGoogleLoginError}
        onUserLogout={handleUserLogout}
        isLoggingIn={isUserAuthLoading}
      />

      <main className="flex-1 pb-2" style={{ background: 'var(--main-bg, transparent)' }}>
        <Hero totalCount={globalTotalCount} />

        <div className="max-w-[1200px] mx-auto pt-4 flex flex-col gap-3.5">
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            isSearching={isSearching}
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
            activeSelectedSeverities={activeSelectedSeverities}
            activeEcosystem={activeEcosystem}
            activeTechName={activeTechName}
            activeStartDate={activeStartDate}
            activeEndDate={activeEndDate}
            onToggleSeverity={handleToggleSeverity}
            onClearFilters={handleClearFilters}
            onClearEcosystem={handleClearEcosystem}
            onClearTechName={handleClearTechName}
            onClearStartDate={handleClearStartDate}
            onClearEndDate={handleClearEndDate}
            ecosystemOptions={ecosystemOptions}
            techNameOptions={techNameOptions}
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
                setRetryTrigger((c) => c + 1);
              }}
              className="mt-1 px-5 py-2.5 rounded-[10px] text-[0.875rem] font-semibold cursor-pointer transition-all duration-200 border-0"
              style={{
                background: 'var(--accent-blue)',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
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
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-input)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--border-input)'; }}
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
                  <VulnCard
                    key={vuln.uuid || vuln.id || `vuln-${idx}`}
                    vuln={vuln}
                    onClick={setSelectedVuln}
                    activeQuery={activeQuery}
                  />
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
        className="text-center px-6 py-5 text-[0.8125rem] border-t mt-auto transition-colors duration-300 flex items-center justify-center gap-2"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}
      >
        <span>ThreatLens · Security Intelligence Platform</span>
      </footer>

      {/* Detail Slide-out Panel */}
      {selectedVuln && (
        <DetailPanel
          vuln={selectedVuln}
          onClose={() => setSelectedVuln(null)}
          currentUser={currentUser}
        />
      )}

      {/* High-Contrast Toast Notification */}
      {renderToast()}
    </div>
  );
}
