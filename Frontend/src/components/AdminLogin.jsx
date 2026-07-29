import { useState } from 'react';

const ShieldIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
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

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default function AdminLogin({ theme, onToggleTheme, onLoginSuccess, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter your admin username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      // Allow any non-empty username or default demo credentials for prototype
      if (username.trim().toLowerCase() === 'admin' && password !== 'admin123' && password !== 'admin') {
        setError('Invalid admin credentials. Try username: admin / password: admin123');
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess({
        username: username.trim(),
        role: 'ADMIN',
        loggedInAt: new Date().toISOString(),
      });
      setIsSubmitting(false);
    }, 400);
  };

  const handleDemoLogin = () => {
    setUsername('admin');
    setPassword('admin123');
    setIsSubmitting(true);
    setTimeout(() => {
      onLoginSuccess({
        username: 'admin',
        role: 'ADMIN',
        loggedInAt: new Date().toISOString(),
      });
      setIsSubmitting(false);
    }, 300);
  };

  return (
    <div className="h-screen flex flex-col justify-between relative overflow-hidden" style={{ background: 'var(--main-bg, var(--bg-primary))' }}>
      {/* Top Header Bar */}
      <header className="px-6 py-2.5 flex items-center justify-between z-10 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 text-xs font-semibold cursor-pointer transition-all duration-150 hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeftIcon />
          <span>Back to ThreatLens</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
          style={{
            borderColor: 'var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
          }}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-2 sm:py-4 z-10 min-h-0 overflow-y-auto">
        <div
          className="w-full max-w-[400px] rounded-[16px] border p-5 sm:p-6 shadow-xl backdrop-blur-xl transition-all duration-300 animate-fade-in my-auto"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {/* Header Title & Branding */}
          <div className="flex flex-col items-center text-center mb-4">
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center text-white mb-2 shadow-md transition-transform hover:scale-105"
              style={{ background: 'var(--accent-blue)' }}
            >
              <ShieldIcon />
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-0.5" style={{ color: 'var(--text-heading)' }}>
              ThreatLens Admin
            </h1>
            <p className="text-[0.68rem] uppercase tracking-[0.08em] font-semibold" style={{ color: 'var(--accent-blue)' }}>
              Management Console Authentication
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div
              className="mb-4 p-2.5 rounded-[8px] text-xs font-medium border flex items-center gap-2 animate-shake"
              style={{
                background: 'var(--sev-critical-bg)',
                color: 'var(--sev-critical-text)',
                borderColor: 'var(--sev-critical-border)',
              }}
            >
              <span className="text-sm">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Username Input */}
            <div className="flex flex-col gap-1">
              <label htmlFor="admin-username-input" className="text-[0.7rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Username
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                  <UserIcon />
                </span>
                <input
                  id="admin-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter admin username..."
                  autoComplete="username"
                  autoFocus
                  className="w-full h-9.5 pl-10 pr-3 rounded-[8px] border text-xs outline-none transition-all duration-200"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-input)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1">
              <label htmlFor="admin-password-input" className="text-[0.7rem] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
                  <LockIcon />
                </span>
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Enter password..."
                  autoComplete="current-password"
                  className="w-full h-9.5 pl-10 pr-10 rounded-[8px] border text-xs outline-none transition-all duration-200"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-input)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 p-1 rounded-md cursor-pointer transition-opacity opacity-60 hover:opacity-100"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="admin-login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="mt-1 h-9.5 rounded-[8px] text-xs font-semibold text-white cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 border-0"
              style={{ background: 'var(--accent-blue)' }}
              onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
              onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent-blue)'; }}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In to Admin Panel</span>
              )}
            </button>
          </form>

          {/* Quick Demo Login Option */}
          <div className="mt-3.5 pt-3 border-t text-center flex flex-col gap-1.5" style={{ borderColor: 'var(--border-card)' }}>
            <p className="text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
              Demo environment quick access:
            </p>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="px-3 py-1.5 rounded-[7px] border text-[0.72rem] font-semibold cursor-pointer transition-all duration-150"
              style={{
                background: 'var(--bg-badge)',
                borderColor: 'var(--border-card)',
                color: 'var(--accent-blue)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-blue-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-badge)';
              }}
            >
              Quick Demo Admin Login (User: admin)
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-2 text-center text-[0.7rem] z-10 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
        ThreatLens Security Portal · Restricted Admin Access
      </footer>
    </div>
  );
}
