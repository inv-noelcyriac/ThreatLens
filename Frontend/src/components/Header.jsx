const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function Header({ theme, onToggleTheme }) {
  return (
    <header
      className="sticky top-0 z-[100] backdrop-blur-[16px] border-b transition-all duration-300"
      style={{ background: 'var(--bg-header)', borderColor: 'var(--border-color)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-[34px] h-[34px] rounded-[8px] flex items-center justify-center text-white flex-shrink-0 transition-colors duration-300"
            style={{ background: 'var(--accent-blue)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span
            className="text-base font-bold tracking-tight transition-colors duration-300"
            style={{ color: 'var(--text-primary)' }}
          >
            ThreatLens
          </span>
          <span className="text-[0.9rem]" style={{ color: 'var(--text-muted)' }}>/</span>
          <span className="text-[0.875rem] font-normal transition-colors duration-300" style={{ color: 'var(--text-secondary)' }}>
            Vulnerability Search
          </span>
        </div>

        {/* Theme toggle */}
        <button
          id="theme-toggle-btn"
          className="w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
          }}
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
