import { useState, useEffect } from 'react';

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const SEVERITY_OPTIONS = [
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'HIGH', label: 'High' },
  { key: 'MEDIUM', label: 'Medium' },
  { key: 'LOW', label: 'Low' },
];

export default function VulnFormModal({
  isOpen = true,
  onClose,
  onSave,
  vulnToEdit = null,
  initialData = null,
  ecosystemOptions = [],
  techNameOptions = [],
  onAddEcosystemOption,
  onAddTechNameOption,
}) {
  const targetData = vulnToEdit || initialData;
  const isEdit = Boolean(targetData && (targetData.id || targetData.display_id || targetData.uuid));

  const [cveId, setCveId] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [cvss, setCvss] = useState('7.5');
  const [ecosystem, setEcosystem] = useState('');
  const [techName, setTechName] = useState('');
  const [publishedDate, setPublishedDate] = useState('');
  const [description, setDescription] = useState('');
  const [remediation, setRemediation] = useState('');

  const [showEcoMenu, setShowEcoMenu] = useState(false);
  const [showTechMenu, setShowTechMenu] = useState(false);
  const [error, setError] = useState('');

  // Populate form fields on open or when targetData changes
  useEffect(() => {
    if (isOpen) {
      if (targetData) {
        setCveId(targetData.display_id || targetData.id || '');
        setTitle(targetData.title || '');
        setSeverity((targetData.severity || 'MEDIUM').toUpperCase());
        setCvss(String(targetData.cvss ?? '7.5'));
        setEcosystem(targetData.ecosystem || '');

        const primaryComp = targetData.affectedComponents && targetData.affectedComponents.length > 0
          ? targetData.affectedComponents[0].component
          : '';
        setTechName(primaryComp || '');

        const rawDate = targetData.date || targetData.published || '';
        setPublishedDate(rawDate);
        setDescription(targetData.description || '');
        setRemediation(typeof targetData.remediation === 'string' ? targetData.remediation : '');
      } else {
        // Default empty form for Add
        const today = new Date();
        const dStr = String(today.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const formattedToday = `${dStr} ${months[today.getMonth()]} ${today.getFullYear()}`;

        setCveId(`CVE-2026-${Math.floor(1000 + Math.random() * 9000)}`);
        setTitle('');
        setSeverity('HIGH');
        setCvss('8.0');
        setEcosystem('npm');
        setTechName('');
        setPublishedDate(formattedToday);
        setDescription('');
        setRemediation('');
      }
      setError('');
    }
  }, [isOpen, targetData]);

  if (!isOpen) return null;

  // Filtered dropdown lists
  const filteredEcoOptions = ecosystemOptions.filter(opt =>
    opt.toLowerCase().includes((ecosystem || '').toLowerCase())
  );
  const isEcoExactMatch = ecosystemOptions.some(opt => opt.toLowerCase() === (ecosystem || '').trim().toLowerCase());

  const filteredTechOptions = techNameOptions.filter(opt =>
    opt.toLowerCase().includes((techName || '').toLowerCase())
  );
  const isTechExactMatch = techNameOptions.some(opt => opt.toLowerCase() === (techName || '').trim().toLowerCase());

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!cveId.trim()) {
      setError('CVE ID / Display ID is required.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!ecosystem.trim()) {
      setError('Ecosystem is required.');
      return;
    }

    // Auto add ecosystem or techName to option lists if new
    if (ecosystem.trim() && !isEcoExactMatch && onAddEcosystemOption) {
      onAddEcosystemOption(ecosystem.trim());
    }
    if (techName.trim() && !isTechExactMatch && onAddTechNameOption) {
      onAddTechNameOption(techName.trim());
    }

    const cvssNum = Math.min(10, Math.max(0, parseFloat(cvss) || 5.0));

    const formData = {
      ...(targetData || {}),
      id: cveId.trim(),
      display_id: cveId.trim(),
      uuid: targetData?.uuid || cveId.trim(),
      title: title.trim(),
      severity: severity.toUpperCase(),
      cvss: cvssNum,
      ecosystem: ecosystem.trim(),
      source: targetData?.source || 'Admin Entry',
      date: publishedDate.trim() || 'Today',
      published: publishedDate.trim() || 'Today',
      description: description.trim() || `Vulnerability ${cveId.trim()} advisory description.`,
      remediation: remediation.trim() || 'Apply vendor security patch or upgrade to fixed version.',
      affectedComponents: [
        {
          component: techName.trim() || cveId.trim(),
          affectedVersions: 'Vulnerable release',
          instance: ecosystem.trim(),
          status: 'VULNERABLE',
        },
      ],
      references: targetData?.references || [{ id: 1, name: 'Vendor Advisory', url: '#' }],
    };

    onSave(formData, isEdit);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto backdrop-blur-md transition-all animate-fade-in"
      style={{ background: 'rgba(0, 0, 0, 0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[620px] rounded-[18px] border shadow-2xl overflow-hidden flex flex-col my-auto transition-all animate-scale-up"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-card)',
          boxShadow: 'var(--shadow-md)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-card)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'var(--accent-blue)' }}
            >
              {isEdit ? <EditIcon /> : <PlusIcon />}
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                {isEdit ? `Edit Vulnerability (${initialData?.display_id || initialData?.id})` : 'Add New Vulnerability'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {isEdit ? 'Update vulnerability details and remediation guidance' : 'Create a new security advisory record in ThreatLens'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-105"
            style={{ borderColor: 'var(--border-card)', background: 'var(--bg-badge)', color: 'var(--text-secondary)' }}
            aria-label="Close modal"
          >
            <XIcon />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <div
              className="p-3 rounded-[10px] text-xs font-semibold border flex items-center gap-2"
              style={{
                background: 'var(--sev-critical-bg)',
                color: 'var(--sev-critical-text)',
                borderColor: 'var(--sev-critical-border)',
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: CVE ID & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="vuln-modal-cve" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                CVE / Advisory ID <span className="text-red-500">*</span>
              </label>
              <input
                id="vuln-modal-cve"
                type="text"
                value={cveId}
                onChange={(e) => setCveId(e.target.value)}
                placeholder="e.g. CVE-2026-1049"
                className="h-10 px-3 rounded-[8px] border-[1.5px] text-sm outline-none transition-all font-mono"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vuln-modal-severity" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Severity Level
              </label>
              <select
                id="vuln-modal-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="h-10 px-3 rounded-[8px] border-[1.5px] text-sm outline-none font-bold cursor-pointer"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-heading)',
                }}
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vuln-modal-title" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
              Title / Summary <span className="text-red-500">*</span>
            </label>
            <input
              id="vuln-modal-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Remote Code Execution in Package Name"
              className="h-10 px-3 rounded-[8px] border-[1.5px] text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Row 2: Dynamic Ecosystem & Tech Name Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ecosystem Dynamic Selection */}
            <div className="flex flex-col gap-1.5 relative">
              <label htmlFor="vuln-modal-ecosystem" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Ecosystem <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  id="vuln-modal-ecosystem"
                  type="text"
                  value={ecosystem}
                  onChange={(e) => {
                    setEcosystem(e.target.value);
                    setShowEcoMenu(true);
                  }}
                  onFocus={() => setShowEcoMenu(true)}
                  onBlur={() => setTimeout(() => setShowEcoMenu(false), 200)}
                  placeholder="Select or type ecosystem..."
                  className="w-full h-10 pl-3 pr-8 rounded-[8px] border-[1.5px] text-sm outline-none"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowEcoMenu((v) => !v)}
                  className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center cursor-pointer border-l bg-transparent opacity-60 hover:opacity-100"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {/* Dynamic Dropdown for Ecosystem */}
              {showEcoMenu && (
                <div
                  className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-[8px] border py-1 shadow-lg"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
                >
                  {filteredEcoOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEcosystem(opt);
                        setShowEcoMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium cursor-pointer flex items-center justify-between"
                      style={{
                        color: ecosystem === opt ? 'var(--accent-blue)' : 'var(--text-primary)',
                        background: ecosystem === opt ? 'var(--accent-blue-light)' : 'transparent',
                      }}
                    >
                      <span>{opt}</span>
                      {ecosystem === opt && <CheckIcon />}
                    </button>
                  ))}

                  {/* Add Custom Option Action */}
                  {ecosystem.trim() && !isEcoExactMatch && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const newOpt = ecosystem.trim();
                        if (onAddEcosystemOption) onAddEcosystemOption(newOpt);
                        setEcosystem(newOpt);
                        setShowEcoMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer border-t flex items-center gap-1.5 transition-colors"
                      style={{
                        borderColor: 'var(--border-card)',
                        color: 'var(--accent-blue)',
                        background: 'var(--bg-badge)',
                      }}
                    >
                      <PlusIcon />
                      <span>Add "{ecosystem.trim()}" as option</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Technology Name Dynamic Selection */}
            <div className="flex flex-col gap-1.5 relative">
              <label htmlFor="vuln-modal-tech" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Technology / Package Name
              </label>
              <div className="relative flex items-center">
                <input
                  id="vuln-modal-tech"
                  type="text"
                  value={techName}
                  onChange={(e) => {
                    setTechName(e.target.value);
                    setShowTechMenu(true);
                  }}
                  onFocus={() => setShowTechMenu(true)}
                  onBlur={() => setTimeout(() => setShowTechMenu(false), 200)}
                  placeholder="Select or type technology..."
                  className="w-full h-10 pl-3 pr-8 rounded-[8px] border-[1.5px] text-sm outline-none"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border-input)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTechMenu((v) => !v)}
                  className="absolute right-0 top-0 bottom-0 px-2.5 flex items-center justify-center cursor-pointer border-l bg-transparent opacity-60 hover:opacity-100"
                  style={{ borderColor: 'var(--border-input)', color: 'var(--text-muted)' }}
                >
                  <ChevronDownIcon />
                </button>
              </div>

              {/* Dynamic Dropdown for Tech Name */}
              {showTechMenu && (
                <div
                  className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-[8px] border py-1 shadow-lg"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
                >
                  {filteredTechOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setTechName(opt);
                        setShowTechMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs font-medium cursor-pointer flex items-center justify-between"
                      style={{
                        color: techName === opt ? 'var(--accent-blue)' : 'var(--text-primary)',
                        background: techName === opt ? 'var(--accent-blue-light)' : 'transparent',
                      }}
                    >
                      <span>{opt}</span>
                      {techName === opt && <CheckIcon />}
                    </button>
                  ))}

                  {/* Add Custom Tech Option Action */}
                  {techName.trim() && !isTechExactMatch && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const newOpt = techName.trim();
                        if (onAddTechNameOption) onAddTechNameOption(newOpt);
                        setTechName(newOpt);
                        setShowTechMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold cursor-pointer border-t flex items-center gap-1.5 transition-colors"
                      style={{
                        borderColor: 'var(--border-card)',
                        color: 'var(--accent-blue)',
                        background: 'var(--bg-badge)',
                      }}
                    >
                      <PlusIcon />
                      <span>Add "{techName.trim()}" as option</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: CVSS Score & Published Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="vuln-modal-cvss" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                CVSS v3.1 Score (0.0 - 10.0)
              </label>
              <input
                id="vuln-modal-cvss"
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={cvss}
                onChange={(e) => setCvss(e.target.value)}
                placeholder="7.5"
                className="h-10 px-3 rounded-[8px] border-[1.5px] text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="vuln-modal-date" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                Published Date
              </label>
              <input
                id="vuln-modal-date"
                type="text"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                placeholder="e.g. 29 Jul 2026"
                className="h-10 px-3 rounded-[8px] border-[1.5px] text-sm outline-none"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: 'var(--border-input)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vuln-modal-desc" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
              Advisory Description
            </label>
            <textarea
              id="vuln-modal-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide technical analysis and impact details..."
              className="p-3 rounded-[8px] border-[1.5px] text-sm outline-none resize-y font-[inherit]"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Official Fix / Remediation */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="vuln-modal-remediation" className="text-xs font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
              Remediation / Official Fix Guidance
            </label>
            <textarea
              id="vuln-modal-remediation"
              rows={2}
              value={remediation}
              onChange={(e) => setRemediation(e.target.value)}
              placeholder="e.g. Upgrade to version 2.4.1 or apply vendor patch."
              className="p-3 rounded-[8px] border-[1.5px] text-sm outline-none resize-y font-[inherit]"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-card)' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[8px] border text-xs font-semibold cursor-pointer transition-colors"
              style={{
                borderColor: 'var(--border-card)',
                background: 'var(--bg-badge)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              id="vuln-modal-save-btn"
              type="submit"
              className="px-5 py-2 rounded-[8px] text-xs font-bold text-white cursor-pointer transition-all border-0 shadow-sm"
              style={{ background: 'var(--accent-blue)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
            >
              {isEdit ? 'Save Changes' : 'Create Vulnerability'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
