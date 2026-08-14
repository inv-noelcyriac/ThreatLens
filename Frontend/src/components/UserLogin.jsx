import GoogleLoginButton from './GoogleLoginButton';

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ── Mock CVE data matching ThreatLens card format ──
const MOCK_VULNS = [
  {
    id: 'CVE-2024-21887',
    description: 'Remote command injection in Ivanti Connect Secure gateway via crafted requests.',
    severity: 'CRITICAL',
    cvss: '9.1',
    ecosystem: 'Security',
    source: 'NVD',
    date: '2024-01-10',
    remediation: 'Apply vendor patch ICS 9.1R18, disable SAML.',
  },
  {
    id: 'CVE-2025-23017',
    description: 'Heap buffer overflow in libpng allows arbitrary code execution via malformed PNG files.',
    severity: 'HIGH',
    cvss: '8.4',
    ecosystem: 'npm',
    source: 'OSV',
    date: '2025-03-14',
  },
  {
    id: 'CVE-2024-38856',
    description: 'Authentication bypass in Apache OFBiz exposes unauthenticated endpoints.',
    severity: 'CRITICAL',
    cvss: '9.8',
    ecosystem: 'Maven',
    source: 'GitHub',
    date: '2024-08-05',
    remediation: 'Upgrade to OFBiz 18.12.15 or later.',
  },
  {
    id: 'CVE-2025-0411',
    description: 'Mark-of-the-Web bypass in 7-Zip allows arbitrary code from archive extraction.',
    severity: 'HIGH',
    cvss: '7.0',
    ecosystem: 'Security',
    source: 'NVD',
    date: '2025-01-20',
  },
  {
    id: 'CVE-2024-4577',
    description: 'PHP CGI argument injection on Windows bypasses CVE-2012-1823 protections.',
    severity: 'CRITICAL',
    cvss: '9.8',
    ecosystem: 'PyPI',
    source: 'CERT',
    date: '2024-06-07',
    remediation: 'Upgrade to PHP 8.1.29, 8.2.20, or 8.3.8.',
  },
  {
    id: 'CVE-2024-29988',
    description: 'SmartScreen bypass lets attackers evade Windows Defender via crafted .zip lnk files.',
    severity: 'HIGH',
    cvss: '8.8',
    ecosystem: 'Security',
    source: 'Microsoft',
    date: '2024-04-09',
  },
  {
    id: 'CVE-2025-1094',
    description: 'SQL injection in PostgreSQL allows privilege escalation via quoting APIs.',
    severity: 'MEDIUM',
    cvss: '6.7',
    ecosystem: 'PyPI',
    source: 'NVD',
    date: '2025-02-13',
    remediation: 'Upgrade to PostgreSQL 17.3, 16.7, or 15.11.',
  },
  {
    id: 'CVE-2024-27198',
    description: 'Authentication bypass in JetBrains TeamCity allows full server takeover.',
    severity: 'CRITICAL',
    cvss: '9.8',
    ecosystem: 'Maven',
    source: 'GitHub',
    date: '2024-03-04',
    remediation: 'Upgrade to TeamCity 2023.11.4.',
  },
  {
    id: 'CVE-2024-49138',
    description: 'Windows CLFS driver heap overflow allows SYSTEM privilege escalation.',
    severity: 'HIGH',
    cvss: '7.8',
    ecosystem: 'Security',
    source: 'Microsoft',
    date: '2024-12-10',
  },
  {
    id: 'CVE-2025-24054',
    description: 'NTLM hash spoofing via .library-ms file triggers credential relay.',
    severity: 'HIGH',
    cvss: '8.1',
    ecosystem: 'Security',
    source: 'NVD',
    date: '2025-03-11',
  },
];

const SEV_COLORS = {
  CRITICAL: { accent: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  HIGH:     { accent: '#f97316', bg: 'rgba(249,115,22,0.1)',  text: '#f97316', border: 'rgba(249,115,22,0.22)' },
  MEDIUM:   { accent: '#eab308', bg: 'rgba(234,179,8,0.1)',   text: '#ca8a04', border: 'rgba(234,179,8,0.22)' },
  LOW:      { accent: '#22c55e', bg: 'rgba(34,197,94,0.1)',   text: '#16a34a', border: 'rgba(34,197,94,0.22)' },
};

// Inline ghost card (no absolute positioning — used inside marquee strips)
function GhostCard({ vuln, theme }) {
  const isDark = theme === 'dark';
  const sevKey = (vuln.severity || 'MEDIUM').toUpperCase();
  const sev = SEV_COLORS[sevKey] || SEV_COLORS.MEDIUM;

  const cardBg    = isDark ? 'rgba(22,23,29,0.88)'    : 'rgba(255,255,255,0.88)';
  const borderCol = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.13)';
  const headingCol   = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.78)';
  const secondaryCol = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.52)';
  const badgeBg      = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  const badgeBorder  = isDark ? 'rgba(255,255,255,0.15)'  : 'rgba(0,0,0,0.12)';

  return (
    <div
      className="flex-shrink-0 pointer-events-none select-none rounded-[12px] border"
      style={{
        width: '220px',
        background: cardBg,
        borderColor: borderCol,
        padding: '10px 14px',
        boxShadow: isDark ? '0 8px 28px rgba(0,0,0,0.55)' : '0 4px 20px rgba(0,0,0,0.14)',
      }}
    >
      {/* Ecosystem badge */}
      <div className="mb-1.5">
        <span
          className="text-[0.62rem] font-medium px-2 py-0.5 rounded-[4px] border"
          style={{ background: badgeBg, borderColor: badgeBorder, color: secondaryCol }}
        >
          ecosystem: {vuln.ecosystem}
        </span>
      </div>

      {/* CVE ID */}
      <div
        className="text-[0.85rem] font-bold mb-0.5 truncate"
        style={{ color: headingCol, fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace" }}
      >
        {vuln.id}
      </div>

      {/* Description */}
      <div
        className="text-[0.72rem] leading-snug mb-2"
        style={{
          color: secondaryCol,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {vuln.description}
      </div>

      {/* Severity + CVSS blocks */}
      <div className="flex gap-1.5 mb-1.5">
        <div
          className="flex-1 px-2 py-1 rounded-[6px]"
          style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
        >
          <div className="text-[0.56rem] uppercase tracking-widest font-semibold" style={{ color: secondaryCol }}>severity</div>
          <div className="text-[0.75rem] font-bold uppercase" style={{ color: sev.text }}>{sevKey}</div>
        </div>
        <div
          className="px-2 py-1 rounded-[6px] border min-w-[52px]"
          style={{ background: badgeBg, borderColor: badgeBorder }}
        >
          <div className="text-[0.56rem] uppercase tracking-widest" style={{ color: secondaryCol }}>cvss</div>
          <div className="text-[0.75rem] font-bold" style={{ color: headingCol }}>{vuln.cvss}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[0.62rem]" style={{ color: secondaryCol }}>
        <span className="truncate">source: {vuln.source}</span>
        <span className="flex-shrink-0">{vuln.date}</span>
      </div>
    </div>
  );
}

// Horizontal marquee strip — direction: 'right' | 'left'
function MarqueeStrip({ vulns, direction, theme }) {
  // Duplicate for seamless loop: animation moves exactly 50% of total width.
  // IMPORTANT: use marginRight (not gap) so each copy has a trailing space,
  // making both halves exactly equal width — no seam jump at loop boundary.
  const items = [...vulns, ...vulns];
  return (
    <div style={{
      overflow: 'hidden',
      width: '100%',
      /* Promote the clipping container to its own GPU layer so the
         inner animation never triggers a main-thread repaint */
      transform: 'translateZ(0)',
      isolation: 'isolate',
      perspective: '1000px',
    }}>
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          animation: `marquee-${direction} 65s linear infinite`,
          opacity: 0.85,
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transformStyle: 'preserve-3d',
        }}
      >
        {items.map((vuln, i) => (
          <div key={i} style={{ marginRight: '16px', flexShrink: 0 }}>
            <GhostCard vuln={vuln} theme={theme} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Floating ghost vulnerability cards background
function BackgroundVulnCards({ theme }) {
  const isDark = theme === 'dark';

  // Use all cards for both strips — wider coverage on large displays
  const topVulns    = MOCK_VULNS;
  const bottomVulns = [...MOCK_VULNS].reverse();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Subtle dot grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1"
              fill={isDark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.06)'} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* Ambient glow blobs */}
      <div className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          top: '-5%', left: '-10%',
          background: isDark
            ? 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)',
        }}
      />
      <div className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          bottom: '-5%', right: '-5%',
          background: isDark
            ? 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Top strip — scrolls right — sits in top ~22% of viewport */}
      <div className="absolute left-0 right-0" style={{ top: '10%' }}>
        <MarqueeStrip vulns={topVulns} direction="right" theme={theme} />
      </div>

      {/* Bottom strip — scrolls left — sits in bottom ~22% of viewport */}
      <div className="absolute left-0 right-0" style={{ bottom: '10%' }}>
        <MarqueeStrip vulns={bottomVulns} direction="left" theme={theme} />
      </div>

      {/* Centre radial fade — masks cards behind the login panel */}
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(13,14,17,0.82) 0%, transparent 100%)'
            : 'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(238,240,246,0.85) 0%, transparent 100%)',
        }}
      />
    </div>
  );
}

export default function UserLogin({
  theme,
  onToggleTheme,
  onGoogleLoginSuccess,
  onGoogleLoginError,
  isLoggingIn,
}) {
  return (
    <div
      className="overflow-hidden font-sans select-none"
      style={{
        position: 'fixed',
        inset: 0,               /* always covers the exact visible viewport — immune to zoom:1.3 */
        background: 'var(--main-bg, var(--bg-primary))',
        display: 'grid',
        placeItems: 'center',
        zIndex: 0,
      }}
    >
      {/* Animated ghost vuln cards background */}
      <BackgroundVulnCards theme={theme} />

      {/* Floating theme toggle — top-right corner */}
      <button
        type="button"
        onClick={onToggleTheme}
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-[10px] border flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 shadow-md"
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--bg-card)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>

      {/* Main Login Card — always centred by grid on the outer wrapper */}
      <main className="relative z-10 w-full flex items-center justify-center px-4">
        <div
          className="w-full max-w-[420px] rounded-[16px] border p-8 sm:p-9 shadow-2xl transition-all duration-300 animate-fade-in flex flex-col items-center text-center gap-5"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.22)',
          }}
        >
          {/* Logo Badge Icon */}
          <div
            className="w-12 h-12 rounded-[12px] flex items-center justify-center text-white flex-shrink-0 shadow-md mb-1"
            style={{ background: 'var(--accent-blue)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          {/* Title & Subtitle */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
              Welcome to ThreatLens
            </h1>
            <p className="text-xs sm:text-[0.8125rem] leading-relaxed max-w-[320px]" style={{ color: 'var(--text-secondary)' }}>
              Sign in with your Google account to access security advisories and vulnerability intelligence.
            </p>
          </div>

          {/* Divider Line */}
          <div className="w-full border-t my-0.5" style={{ borderColor: 'var(--border-color)' }} />

          {/* Google Sign-In Button Container */}
          <div className="w-full flex justify-center pt-1">
            <GoogleLoginButton
              theme={theme}
              onSuccess={onGoogleLoginSuccess}
              onError={onGoogleLoginError}
              isLoading={isLoggingIn}
              size="large"
              text="continue_with"
              width="340"
            />
          </div>
        </div>
      </main>

    </div>
  );
}
