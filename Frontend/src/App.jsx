import { useState, useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchBar, { DEFAULT_ECOSYSTEM_OPTIONS, DEFAULT_TECH_NAME_OPTIONS } from './components/SearchBar';
import SortControls from './components/SortControls';
import VulnCard from './components/VulnCard';
import Pagination from './components/Pagination';
import DetailPanel from './components/DetailPanel';
import AdminLogin from './components/AdminLogin';
import VulnFormModal from './components/VulnFormModal';
import { fetchVulnerabilities } from './services/api';

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

  // Admin & Routing State
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('threatlens-is-admin') === 'true');
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('threatlens-admin-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  // Dropdown Options State
  const ecosystemOptions = DEFAULT_ECOSYSTEM_OPTIONS;
  const techNameOptions = DEFAULT_TECH_NAME_OPTIONS;

  // Vuln Form Modal State (Add / Edit)
  const [vulnModalOpen, setVulnModalOpen] = useState(false);
  const [editingVuln, setEditingVuln] = useState(null);

  // API Data State
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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

  // Lock body scroll when detail panel or modal is open
  useEffect(() => {
    document.body.style.overflow = selectedVuln || vulnModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedVuln, vulnModalOpen]);



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

  const handleAdminLoginSuccess = (userData) => {
    setIsAdmin(true);
    setAdminUser(userData);
    localStorage.setItem('threatlens-is-admin', 'true');
    localStorage.setItem('threatlens-admin-user', JSON.stringify(userData));
    showToast('Authenticated as Administrator. Switched to Admin Mode.', 'success');
    window.history.replaceState({}, '', '/');
    setCurrentPath('/');
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminUser(null);
    localStorage.removeItem('threatlens-is-admin');
    localStorage.removeItem('threatlens-admin-user');
    showToast('Logged out of Admin Mode. Switched to User Mode.', 'info');
    window.history.replaceState({}, '', '/');
    setCurrentPath('/');
  };

  const handleSearch = () => {
    setActiveQuery(query.trim());
    setActiveEcosystem(ecosystem.trim());
    setActiveTechName(techName.trim());
    setActiveStartDate(startDate);
    setActiveEndDate(endDate);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setQuery('');
    setActiveQuery('');
    setCurrentPage(1);
  };

  const handleToggleSeverity = (sev) => {
    setSelectedSeverities((prev) => {
      if (prev.includes(sev)) {
        setCurrentPage(1);
        return prev.filter(s => s !== sev);
      }
      if (prev.length >= 3) return prev;
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



  // Add / Edit handlers
  const handleOpenAddModal = () => {
    const draftVuln = {
      isNew: true,
      display_id: '',
      id: '',
      title: '',
      severity: '',
      cvss: '',
      ecosystem: '',
      tech_name: '',
      published: '',
      status: '',
      description: '',
      remediation: '',
      affectedComponents: [],
      references: [],
    };
    setSelectedVuln(draftVuln);
  };

  const handleOpenEditModal = (vulnToEdit) => {
    setSelectedVuln(vulnToEdit);
  };

  const handleSaveVuln = (formData) => {
    const targetId = formData?.id;
    const targetUuid = formData?.uuid;

    if (!formData.isNew && (targetId || targetUuid)) {
      // Update existing record in local state feed
      setVulnerabilities((prev) =>
        prev.map((v) => ((targetId && (v.id === targetId || v.display_id === targetId)) || (targetUuid && v.uuid === targetUuid) ? { ...v, ...formData } : v))
      );
      if (selectedVuln && ((targetId && (selectedVuln.id === targetId || selectedVuln.display_id === targetId)) || (targetUuid && selectedVuln.uuid === targetUuid))) {
        setSelectedVuln((prev) => ({ ...prev, ...formData }));
      }
      setToast({ message: 'Vulnerability advisory updated successfully!', type: 'success' });
    } else {
      // Add new record to top of list
      const newRecord = {
        uuid: `custom-${Date.now()}`,
        id: formData.display_id || formData.id || `CVE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        display_id: formData.display_id || formData.id || `CVE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        ...formData,
        isNew: false,
      };
      setVulnerabilities((prev) => [newRecord, ...prev]);
      setTotalCount((count) => count + 1);
      setToast({ message: `New vulnerability advisory ${newRecord.display_id} created successfully!`, type: 'success' });
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
    const html = document.documentElement;
    html.classList.add('theme-transitioning');
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
    setTimeout(() => html.classList.remove('theme-transitioning'), 400);
  };

  // Automatically redirect authenticated admins away from /admin login page
  useEffect(() => {
    if (isAdmin && (currentPath === '/admin' || currentPath === '/admin/' || currentPath === '/admin/login')) {
      window.history.replaceState({}, '', '/');
      setCurrentPath('/');
    }
  }, [isAdmin, currentPath]);

  // Route 1: Admin Login Endpoint (/admin/login or /admin)
  if (currentPath === '/admin/login' || currentPath === '/admin' || currentPath === '/admin/') {
    if (isAdmin) return null;

    return (
      <AdminLogin
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLoginSuccess={handleAdminLoginSuccess}
        onCancel={() => {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
        }}
      />
    );
  }

  // Route 2: Main Vulnerability Search Dashboard
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isAdmin={isAdmin}
        adminUser={adminUser}
        onOpenAddModal={handleOpenAddModal}
        onAdminLoginClick={() => navigateTo('/admin/login')}
        onLogout={handleAdminLogout}
      />

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
                    isAdmin={isAdmin}
                    onEdit={handleOpenEditModal}
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
        {isAdmin && <span className="text-amber-400 font-semibold">(Admin Access Active)</span>}
      </footer>

      {/* Detail Slide-out Panel (Handles View, Edit, and Create modes) */}
      {selectedVuln && (
        <DetailPanel
          vuln={selectedVuln}
          onClose={() => setSelectedVuln(null)}
          isAdmin={isAdmin}
          onSave={handleSaveVuln}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[300] px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-sm font-medium transition-all animate-bounce-subtle cursor-default"
          style={{
            background: 'var(--bg-card)',
            borderColor: toast.type === 'success' ? '#10b981' : 'var(--accent-blue)',
            color: 'var(--text-primary)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          }}
          role="status"
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: toast.type === 'success' ? '#10b981' : 'var(--accent-blue)' }}
          />
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-xs opacity-60 hover:opacity-100 cursor-pointer font-bold border-0 bg-transparent"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
