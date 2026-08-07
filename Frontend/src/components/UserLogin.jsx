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

// Animated SVG background — floating network nodes with edges, scan line, and pulse rings
function CyberBackground({ theme }) {
  const isDark = theme === 'dark';
  const nodeColor = isDark ? 'rgba(96,165,250,0.9)' : 'rgba(37,99,235,0.75)';
  const edgeColor = isDark ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.12)';
  const scanColor = isDark ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.05)';
  const ringColor = isDark ? 'rgba(239,68,68,0.35)' : 'rgba(220,38,38,0.22)';
  const labelColor = isDark ? 'rgba(96,165,250,0.55)' : 'rgba(37,99,235,0.4)';

  // Node positions as % of viewport (kept away from centre where login card is)
  const nodes = [
    { id: 'n1', cx: '8%',  cy: '18%', r: 5,   cls: 'cyber-node-a', label: 'CVE-2024-21887' },
    { id: 'n2', cx: '88%', cy: '12%', r: 4,   cls: 'cyber-node-b', label: 'CRITICAL' },
    { id: 'n3', cx: '92%', cy: '55%', r: 6,   cls: 'cyber-node-c', label: '0-day' },
    { id: 'n4', cx: '78%', cy: '85%', r: 4.5, cls: 'cyber-node-d', label: 'EXPLOIT' },
    { id: 'n5', cx: '12%', cy: '72%', r: 5,   cls: 'cyber-node-e', label: 'CVE-2025-0001' },
    { id: 'n6', cx: '50%', cy: '6%',  r: 3.5, cls: 'cyber-node-b', label: 'SCAN' },
    { id: 'n7', cx: '6%',  cy: '44%', r: 4,   cls: 'cyber-node-c', label: 'VULN' },
    { id: 'n8', cx: '85%', cy: '38%', r: 3.5, cls: 'cyber-node-a', label: 'RCE' },
  ];

  // Edges between nodes (as pairs of node percentages for simple SVG lines)
  const edges = [
    ['8%','18%',  '50%','6%'],
    ['50%','6%',  '88%','12%'],
    ['88%','12%', '92%','55%'],
    ['92%','55%', '85%','38%'],
    ['92%','55%', '78%','85%'],
    ['8%','18%',  '6%','44%'],
    ['6%','44%',  '12%','72%'],
    ['12%','72%', '78%','85%'],
    ['85%','38%', '88%','12%'],
    ['6%','44%',  '8%','18%'],
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Subtle dot grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1"
              fill={isDark ? 'rgba(96,165,250,0.12)' : 'rgba(37,99,235,0.08)'} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* Network edge lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {edges.map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={edgeColor}
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}
      </svg>

      {/* Floating network nodes with labels */}
      {nodes.map((n) => (
        <div
          key={n.id}
          className={`absolute ${n.cls}`}
          style={{ left: n.cx, top: n.cy, transform: 'translate(-50%, -50%)' }}
        >
          {/* Pulse rings on larger nodes */}
          {n.r >= 5 && (
            <>
              <div
                className="absolute inset-0 rounded-full cyber-ring"
                style={{
                  border: `1.5px solid ${ringColor}`,
                  margin: `-${n.r * 1.5}px`,
                }}
              />
              <div
                className="absolute inset-0 rounded-full cyber-ring2"
                style={{
                  border: `1px solid ${ringColor}`,
                  margin: `-${n.r * 2.2}px`,
                }}
              />
            </>
          )}
          {/* Node dot */}
          <div
            className="rounded-full cyber-blink"
            style={{
              width: `${n.r * 2}px`,
              height: `${n.r * 2}px`,
              background: nodeColor,
              boxShadow: `0 0 ${n.r * 3}px ${nodeColor}`,
            }}
          />
          {/* Label */}
          <span
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.55rem] tracking-widest uppercase mt-1"
            style={{ top: `${n.r * 2 + 4}px`, color: labelColor }}
          >
            {n.label}
          </span>
        </div>
      ))}

      {/* Horizontal scan line sweeping down */}
      <div
        className="absolute left-0 right-0 cyber-scan"
        style={{
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${scanColor} 20%, ${isDark ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.12)'} 50%, ${scanColor} 80%, transparent 100%)`,
          top: 0,
        }}
      />

      {/* Orbiting dot around top-right corner node */}
      <div
        className="absolute"
        style={{ left: '88%', top: '12%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="relative w-0 h-0">
          <div
            className="absolute w-2 h-2 rounded-full cyber-orbit"
            style={{ background: nodeColor, boxShadow: `0 0 8px ${nodeColor}`, marginLeft: '-4px', marginTop: '-4px' }}
          />
        </div>
      </div>

      {/* Ambient glow blobs */}
      <div
        className="absolute w-[560px] h-[560px] rounded-full pointer-events-none cyber-drift"
        style={{
          top: '5%', left: '-8%',
          background: isDark
            ? 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          bottom: '5%', right: '-5%',
          background: isDark
            ? 'radial-gradient(circle, rgba(239,68,68,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(220,38,38,0.04) 0%, transparent 70%)',
          filter: 'blur(40px)',
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
    <div className="h-screen flex flex-col justify-between relative overflow-hidden font-sans select-none" style={{ background: 'var(--main-bg, var(--bg-primary))' }}>
      {/* Animated cyber background */}
      <CyberBackground theme={theme} />

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

      {/* Main Login Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10 min-h-0 overflow-y-auto">
        <div
          className="w-full max-w-[420px] rounded-[16px] border p-8 sm:p-9 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-fade-in my-auto flex flex-col items-center text-center gap-5"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-card)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.18)',
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
