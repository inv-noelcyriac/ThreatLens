import { useState, useRef, useEffect } from 'react';
import GoogleLoginButton from './GoogleLoginButton';

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

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const UserCheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </svg>
);

const LogOutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export default function Header({
  theme,
  onToggleTheme,
  isAdmin = false,
  adminUser = null,
  currentUser = null,
  onOpenAddModal = () => {},
  onAdminLoginClick = () => {},
  onLogout = () => {},
  onGoogleLoginSuccess = () => {},
  onGoogleLoginError = () => {},
  onUserLogout = () => {},
  isLoggingIn = false,
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const logoutContainerRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close User Menu popover when clicking anywhere outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);


  // Close Logout popover when clicking anywhere outside
  useEffect(() => {
    if (!showLogoutConfirm) return;
    const handleClickOutside = (e) => {
      if (logoutContainerRef.current && !logoutContainerRef.current.contains(e.target)) {
        setShowLogoutConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogoutConfirm]);

  return (
    <header
      className="sticky top-0 z-[100] backdrop-blur-[16px] border-b transition-all duration-300"
      style={{ background: 'var(--bg-header)', borderColor: 'var(--border-color)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[46px] flex items-center justify-between gap-3">
        {/* Brand & Admin Tag */}
        <div className="flex items-center gap-2">
          <div
            className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center text-white flex-shrink-0 transition-colors duration-300"
            style={{ background: 'var(--accent-blue)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span
            className="text-[0.9375rem] font-bold tracking-tight transition-colors duration-300"
            style={{ color: 'var(--text-primary)' }}
          >
            ThreatLens
          </span>
          <span className="text-[0.8125rem]" style={{ color: 'var(--text-muted)' }}>/</span>
          <span className="text-[0.8125rem] font-normal transition-colors duration-300 hidden sm:inline" style={{ color: 'var(--text-secondary)' }}>
            Vulnerability Search
          </span>

          {/* Requirement 2: Explicit Admin Tag in Header */}
          {isAdmin && (
            <div
              id="admin-mode-tag"
              className="ml-1 sm:ml-2 px-2 py-0.5 rounded-full text-[0.68rem] font-extrabold uppercase tracking-[0.08em] flex items-center gap-1.5 border shadow-sm transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-input, rgba(255, 255, 255, 0.25))',
              }}
              title={`Logged in as Admin (${adminUser?.username || 'admin'})`}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--text-primary)' }} />
              <span>Admin Mode</span>
            </div>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              {/* Requirement 4: Add New Vulnerability Button */}
              <button
                id="header-add-vuln-btn"
                type="button"
                onClick={onOpenAddModal}
                className="h-8 px-3 rounded-[7px] text-xs font-semibold text-white cursor-pointer transition-all duration-200 flex items-center gap-1.5 border-0 shadow-sm"
                style={{ background: 'var(--accent-blue)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
                title="Add new vulnerability advisory manually"
              >
                <PlusIcon />
                <span className="hidden sm:inline">Add Vulnerability</span>
              </button>

              {/* Admin Logout Button & Confirmation Popover */}
              <div className="relative" ref={logoutContainerRef}>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm((v) => !v)}
                  className="h-8 px-2.5 rounded-[7px] border text-xs font-bold cursor-pointer transition-all duration-200 flex items-center gap-1.5"
                  style={{
                    borderColor: showLogoutConfirm ? 'rgba(239, 68, 68, 0.5)' : 'var(--border-input, rgba(255, 255, 255, 0.2))',
                    background: showLogoutConfirm ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
                    color: showLogoutConfirm ? '#ef4444' : 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (!showLogoutConfirm) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showLogoutConfirm) {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-input, rgba(255, 255, 255, 0.2))';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.transform = 'none';
                    }
                  }}
                  title="Logout from Admin Mode"
                >
                  <span style={{ color: '#ef4444' }}>
                    <LogOutIcon />
                  </span>
                  <span className="hidden md:inline">Logout</span>
                </button>

                {/* Dropdown Confirmation Popover */}
                {showLogoutConfirm && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-[240px] z-[150] rounded-[10px] border p-3.5 shadow-md animate-fade-in flex flex-col gap-3"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-card)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: 'rgba(239, 68, 68, 0.16)', color: '#ef4444' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <h4 className="text-xs font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                          Confirm Logout?
                        </h4>
                        <p className="text-[0.76rem] font-semibold leading-snug" style={{ color: 'var(--text-secondary)' }}>
                          Are you sure you want to exit Admin Mode?
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2.5 border-t" style={{ borderColor: 'var(--border-card)' }}>
                      <button
                        type="button"
                        onClick={() => setShowLogoutConfirm(false)}
                        className="px-2.5 py-1 rounded-[6px] text-[0.72rem] font-bold border cursor-pointer transition-all duration-200"
                        style={{
                          borderColor: 'var(--border-color)',
                          background: 'var(--bg-badge)',
                          color: 'var(--text-primary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-secondary)';
                          e.currentTarget.style.borderColor = 'var(--border-input)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-badge)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLogoutConfirm(false);
                          onLogout();
                        }}
                        className="px-3 py-1 rounded-[6px] text-[0.72rem] font-extrabold text-white cursor-pointer transition-all duration-200 border-0 shadow-sm"
                        style={{ background: '#ef4444' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Standard User Authentication UI */}
          {!isAdmin && (
            currentUser ? (
              /* Logged In User Pill & Dropdown Menu */
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="h-8 px-2.5 rounded-[8px] border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                  style={{
                    borderColor: 'var(--border-input, rgba(255, 255, 255, 0.2))',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                  }}
                  title={`Signed in as ${currentUser.email || currentUser.username}`}
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold text-[0.65rem] flex items-center justify-center uppercase">
                    {(currentUser.first_name?.[0] || currentUser.email?.[0] || 'U')}
                  </div>
                  <span className="max-w-[110px] truncate font-medium hidden sm:inline">
                    {currentUser.first_name || currentUser.username || currentUser.email?.split('@')[0]}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Corporate Access Active" />
                </button>

                {showUserMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 w-[250px] z-[150] rounded-[12px] border p-3.5 shadow-xl animate-fade-in flex flex-col gap-3"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-card)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 font-extrabold text-xs flex items-center justify-center border border-emerald-500/30">
                        {(currentUser.first_name?.[0] || currentUser.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : (currentUser.username || 'ThreatLens User')}
                        </span>
                        <span className="text-[0.72rem] text-emerald-500 font-medium truncate">
                          {currentUser.email || 'authenticated@innovaturelabs.com'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[0.72rem] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-md">
                      <span>Domain Guardrail</span>
                      <span className="font-semibold">@innovaturelabs.com</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onUserLogout();
                      }}
                      className="w-full py-1.5 rounded-[7px] text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/15"
                    >
                      <LogOutIcon />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Google Sign-In Button */
              <GoogleLoginButton
                onSuccess={onGoogleLoginSuccess}
                onError={onGoogleLoginError}
                isLoading={isLoggingIn}
              />
            )
          )}

          {/* Theme Toggle Button */}

          <button
            id="theme-toggle-btn"
            className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
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
      </div>
    </header>
  );
}
