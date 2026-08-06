import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

export default function GoogleLoginButton({
  onSuccess,
  onError,
  isLoading = false,
  className = '',
}) {
  const [authError, setAuthError] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isPlaceholderClientId = !clientId || clientId.includes('your-google-client-id');

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

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      {isLoading ? (
        <div className="h-9 px-4 rounded-[8px] border flex items-center justify-center gap-2 text-xs font-semibold" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-blue)', borderTopColor: 'transparent' }} />
          <span>Authenticating...</span>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[8px]">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap={false}
            shape="rectangular"
            theme="outline"
            size="medium"
            text="signin_with"
            locale="en"
          />
        </div>
      )}

      {isPlaceholderClientId && (
        <span className="text-[0.68rem] text-amber-500 font-medium tracking-tight">
          ⚠️ Set VITE_GOOGLE_CLIENT_ID in .env
        </span>
      )}

      {authError && (
        <span className="text-[0.7rem] text-red-500 font-medium">
          {authError}
        </span>
      )}
    </div>
  );
}
