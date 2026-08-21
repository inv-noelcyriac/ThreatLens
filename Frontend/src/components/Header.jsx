import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import GoogleLoginButton from './GoogleLoginButton';

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const LogOutIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export default function Header({
  theme,
  onToggleTheme,
  currentUser = null,
  currentPath = '/',
  onNavigate = () => { },
  hideGoogleLogin = false,
  onGoogleLoginSuccess = () => { },
  onGoogleLoginError = () => { },
  onUserLogout = () => { },
  isLoggingIn = false,
}) {
  const [showUserLogoutConfirm, setShowUserLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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

  // Lock body scroll when User Logout modal confirmation is active
  useEffect(() => {
    if (showUserLogoutConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showUserLogoutConfirm]);

  return (
    <header
      className="sticky top-0 z-[100] border-b transition-all duration-300"
      style={{ background: 'var(--bg-header)', borderColor: 'var(--border-color)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 h-[46px] flex items-center justify-between gap-3">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 border-0 bg-transparent cursor-pointer p-0 text-left"
          >
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
          </button>


        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {/* Standard User Authentication UI */}
          {currentUser ? (
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
                <div
                  className="w-5 h-5 rounded-full font-bold text-[0.65rem] flex items-center justify-center uppercase shadow-xs transition-colors duration-300"
                  style={{
                    background: 'var(--user-avatar-bg)',
                    color: 'var(--user-avatar-text)',
                  }}
                >
                  {(currentUser.first_name?.[0] || currentUser.email?.[0] || 'U')}
                </div>
                <span className="max-w-[110px] truncate font-medium hidden sm:inline">
                  {currentUser.first_name || currentUser.username || currentUser.email?.split('@')[0]}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-300"
                  style={{ background: 'var(--user-status-dot)' }}
                  title="Corporate Access Active"
                />
              </button>

              {showUserMenu && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-[240px] z-[150] rounded-[12px] border p-2 shadow-xl animate-fade-in flex flex-col gap-1.5"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-card)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  }}
                >
                  <div className="flex items-center gap-2.5 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <div
                      className="w-8 h-8 rounded-full font-extrabold text-xs flex items-center justify-center shadow-xs transition-colors duration-300 flex-shrink-0"
                      style={{
                        background: 'var(--user-avatar-bg)',
                        color: 'var(--user-avatar-text)',
                      }}
                    >
                      {(currentUser.first_name?.[0] || currentUser.email?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : (currentUser.username || 'ThreatLens User')}
                      </span>
                      <span className="text-[0.72rem] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                        {currentUser.email || 'authenticated@innovaturelabs.com'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('/activity');
                      }}
                      className="w-full py-1.5 px-2.5 rounded-[8px] text-xs font-semibold cursor-pointer transition-all duration-200 flex items-center justify-between border-0 hover:bg-black/5 dark:hover:bg-white/5 text-left"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span>My Activity</span>
                      <ChevronRightIcon />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowUserLogoutConfirm(true);
                    }}
                    className="w-full py-1.5 rounded-[8px] text-xs font-bold cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 border border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 hover:shadow-md hover:shadow-red-500/20 active:scale-[0.98]"
                  >
                    <LogOutIcon />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : !hideGoogleLogin ? (
            /* Google Sign-In Pill Button matching user pill design */
            <GoogleLoginButton
              theme={theme}
              variant="pill"
              onSuccess={onGoogleLoginSuccess}
              onError={onGoogleLoginError}
              isLoading={isLoggingIn}
            />
          ) : null}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-[7px] border flex items-center justify-center cursor-pointer transition-all duration-200"
            style={{
              borderColor: 'var(--border-input, rgba(255, 255, 255, 0.2))',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-blue)';
              e.currentTarget.style.color = 'var(--accent-blue)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-input, rgba(255, 255, 255, 0.2))';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* User Logout Confirmation Modal Overlay rendered via Portal directly to body */}
      {showUserLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div
            className="w-full max-w-[365px] rounded-[14px] border p-5 shadow-2xl animate-fade-slide-in flex flex-col gap-3.5"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-card)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-red-500/10 text-red-500 flex-shrink-0 mt-0.5">
                <LogOutIcon size={18} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Sign Out of ThreatLens?
                </h3>
                <p className="text-[0.8125rem] mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  You will need to sign in again to access vulnerability advisories.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setShowUserLogoutConfirm(false)}
                className="px-3.5 py-1.5 rounded-[8px] text-xs font-semibold border cursor-pointer transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.98]"
                style={{
                  borderColor: 'var(--border-color)',
                  background: 'var(--bg-badge)',
                  color: 'var(--text-primary)',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUserLogoutConfirm(false);
                  onUserLogout();
                }}
                className="px-3.5 py-1.5 rounded-[8px] text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-all border-0 shadow-sm active:scale-[0.98]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
