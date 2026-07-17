export default function Hero({ totalCount }) {
  return (
    <section
      className="relative overflow-hidden py-[60px] px-6 text-center transition-all duration-300 sm:py-10 border-b"
      style={{ background: 'var(--hero-gradient)', borderColor: 'var(--hero-border)' }}
    >
      {/* Dark-mode dot texture */}
      <div className="hero-dark-texture absolute inset-0 pointer-events-none" />

      <div className="relative z-10 max-w-[720px] mx-auto flex flex-col items-center gap-[18px]">
        {/* Status pill */}
        <div
          className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-[0.8125rem] font-medium shadow-sm transition-all duration-300"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Animated dot */}
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: '#22c55e',
              boxShadow: '0 0 6px rgba(34,197,94,0.6)',
              animation: 'var(--animate-pulse-dot)',
            }}
            aria-hidden="true"
          />
          Curated CVE feed · {totalCount} advisories indexed
        </div>

        <h1
          className="font-medium leading-[1.08] tracking-[-0.035em] transition-colors duration-300"
          style={{
            fontSize: 'clamp(2.4rem, 6vw, 3.5rem)',
            color: 'var(--text-heading)',
          }}
        >
          Vulnerability Search
        </h1>

        <p
          className="text-base leading-[1.75] max-w-[560px] font-normal transition-colors duration-300"
          style={{ color: 'var(--text-secondary)' }}
        >
          Search across CVEs, ecosystems, and advisories. Filter by severity, sort by date or CVSS score. Click any card to inspect details.
        </p>
      </div>
    </section>
  );
}
