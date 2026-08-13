import React from 'react';
import Header from './Header';

const FileXIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9.5" y1="12.5" x2="14.5" y2="17.5" />
    <line x1="14.5" y1="12.5" x2="9.5" y2="17.5" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function NotFound({
  theme,
  onToggleTheme,
  isAdmin = false,
  adminUser = null,
  currentUser = null,
  onOpenAddModal,
  onAdminLoginClick,
  onLogout,
  onUserLogout,
  onNavigateHome,
}) {
  return (
    <div
      className="h-screen min-h-[100dvh] w-full overflow-hidden flex flex-col justify-between relative transition-colors duration-300"
      style={{ background: 'var(--main-bg, var(--bg-primary))' }}
    >
      {/* Standard Full Application Header */}
      <div className="relative z-10 flex-shrink-0">
        <Header
          theme={theme}
          onToggleTheme={onToggleTheme}
          isAdmin={isAdmin}
          adminUser={adminUser}
          currentUser={currentUser}
          hideGoogleLogin={true}
          onOpenAddModal={onOpenAddModal}
          onAdminLoginClick={onAdminLoginClick}
          onLogout={onLogout}
          onUserLogout={onUserLogout}
        />
      </div>

      {/* Main Content Area — Flex-1 centered with increased optical upward offset */}
      <main className="flex-1 flex items-center justify-center px-4 py-4 z-10 min-h-0 overflow-y-auto pb-16 sm:pb-24">
        <div
          className="w-full max-w-[520px] rounded-[16px] border p-6 sm:p-8 shadow-sm flex items-center gap-5 sm:gap-7 transition-all duration-300 -translate-y-14 sm:-translate-y-20 my-auto"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Left Icon Badge Circle */}
          <div className="flex-shrink-0 flex items-center justify-center">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 relative overflow-hidden"
              style={{
                background: theme === 'dark' ? 'rgba(37, 99, 235, 0.18)' : '#dbeafe',
                color: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
                borderRadius: '50%',
              }}
            >
              <div className="animate-float-icon flex items-center justify-center w-full h-full">
                <FileXIcon />
              </div>
            </div>
          </div>

          {/* Vertical Divider */}
          <div
            className="w-[1px] h-20 sm:h-22 flex-shrink-0"
            style={{ background: 'var(--border-color)' }}
          />

          {/* Right Text Content & Single Action Button */}
          <div className="flex-1 flex flex-col items-start gap-1">
            <h1
              className="text-base sm:text-lg font-bold tracking-tight"
              style={{ color: 'var(--text-heading)' }}
            >
              This route doesn't exist (404)
            </h1>

            <p
              className="text-xs sm:text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              We couldn't match this URL to any page in ThreatLens.
            </p>

            {/* Single Button for SPA Redirection */}
            <div className="mt-3">
              <button
                type="button"
                onClick={onNavigateHome}
                className="h-8 px-3.5 sm:px-4 rounded-[8px] border text-xs font-semibold cursor-pointer transition-all duration-200 flex items-center gap-1.5"
                style={{
                  borderColor: 'var(--border-input)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-blue)';
                  e.currentTarget.style.color = 'var(--accent-blue)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-input)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
              >
                <ArrowLeftIcon />
                <span>Go back</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 py-3 text-center text-[0.72rem] transition-colors duration-300 flex-shrink-0"
        style={{ color: 'var(--text-muted)' }}
      >
        ThreatLens · Security Intelligence Platform
      </footer>
    </div>
  );
}
