import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleGIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" className="flex-shrink-0">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export default function GoogleLoginButton({
  onSuccess,
  onError,
  isLoading = false,
  className = '',
  size = 'large',
  text = 'continue_with',
  width = undefined,
  theme = undefined,
}) {
  const [authError, setAuthError] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isPlaceholderClientId = !clientId || clientId.includes('your-google-client-id');

  const activeThemeMode = theme || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light';
  const googleButtonTheme = activeThemeMode === 'dark' ? 'filled_black' : 'outline';

  const handleGoogleSuccess = (credentialResponse) => {
    setAuthError(null);
    if (credentialResponse && credentialResponse.credential) {
      onSuccess(credentialResponse.credential);
    } else {
      const err = 'Google did not return a valid ID token credential';
      setAuthError(err);
      if (onError) onError(err);
    }
  };

  const handleGoogleError = () => {
    const err = 'Google Sign-In was cancelled or failed to initialize.';
    setAuthError(err);
    if (onError) onError(err);
  };

  const buttonWidth = width ? `${width}px` : '340px';

  return (
    <div
      className={`flex flex-col items-center gap-2 ${className}`}
      style={{ colorScheme: activeThemeMode === 'dark' ? 'dark' : 'light' }}
    >
      {isLoading ? (
        <div
          className="h-12 px-5 rounded-[8px] border flex items-center justify-center gap-3 text-sm font-semibold shadow-sm"
          style={{
            width: buttonWidth,
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
          <span>Authenticating Google session...</span>
        </div>
      ) : (
        <div
          className="group relative h-12 rounded-[8px] border flex items-center justify-center gap-3 transition-all duration-75 ease-out transform-gpu active:scale-[0.98] active:translate-y-[0.5px] cursor-pointer select-none overflow-hidden"
          style={{
            width: buttonWidth,
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
            boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(59, 130, 246, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.06)';
          }}
        >
          {/* Authentic 4-color Google G Icon */}
          <GoogleGIcon />
          <span className="text-[0.9375rem] font-semibold tracking-tight transition-colors duration-200">
            Continue with Google
          </span>

          {/* Invisible Google GIS OAuth Overlay */}
          <div
            className="absolute inset-0 opacity-0 cursor-pointer overflow-hidden flex items-center justify-center scale-125 pointer-events-auto"
            style={{ colorScheme: activeThemeMode === 'dark' ? 'dark' : 'light' }}
          >
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              shape="rectangular"
              theme={googleButtonTheme}
              size={size}
              text={text}
              width="340"
              locale="en"
            />
          </div>
        </div>
      )}

      {isPlaceholderClientId && (
        <span className="text-[0.68rem] text-amber-500 font-medium tracking-tight text-center">
          ⚠️ Set VITE_GOOGLE_CLIENT_ID in .env
        </span>
      )}

      {authError && (
        <span className="text-[0.72rem] text-red-500 font-medium text-center max-w-[280px]">
          {authError}
        </span>
      )}
    </div>
  );
}
