const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

/** Helper to format ISO date string or raw date to 'DD MMM YYYY' */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return dateString;
  }
}

/** Helper to derive source/name from a reference URL */
export function deriveReferenceName(url) {
  if (!url) return 'Reference';
  if (url.includes('nvd.nist.gov')) return 'NVD';
  if (url.includes('github.com')) return 'GitHub Advisory';
  if (url.includes('aws.amazon.com')) return 'AWS Security';
  if (url.includes('wordfence.com')) return 'Wordfence';
  if (url.includes('wordpress.org')) return 'WordPress Trac';
  if (url.includes('openwall.com')) return 'Openwall';
  if (url.includes('huntr.com')) return 'Huntr Bounty';
  
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Reference Link';
  }
}

function extractString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return fallback;
    return extractString(val[0], fallback);
  }
  if (typeof val === 'object') {
    if (val.fixed_version) return `Upgrade ${val.tech_name || 'package'} to ${val.fixed_version}`;
    if (val.raw_version_expression) return `Version ${val.raw_version_expression}`;
    if (val.name) return String(val.name);
    if (val.tech_name) return String(val.tech_name);
    if (val.ecosystem) return String(val.ecosystem);
    if (val.title) return String(val.title);
    return fallback || JSON.stringify(val);
  }
  return String(val);
}

/** Normalizes a backend API vulnerability object into the shape expected by UI components */
export function normalizeVulnerability(raw) {
  if (!raw) return null;

  const displayId = extractString(raw.display_id || raw.id, 'CVE-UNKNOWN');
  const rawDate = raw.published_at || raw.date || raw.published;
  const formattedDate = formatDate(rawDate);

  // Normalize references: convert { id, url } or string to { id, name, url }
  const normalizedRefs = (raw.references || []).map((ref, idx) => {
    if (typeof ref === 'string') {
      return { id: idx, name: deriveReferenceName(ref), url: ref };
    }
    if (typeof ref === 'object' && ref) {
      return {
        id: ref.id || idx,
        name: extractString(ref.name, deriveReferenceName(ref.url)),
        url: extractString(ref.url, '#'),
      };
    }
    return { id: idx, name: 'Reference', url: '#' };
  });

  // Extract source
  let primarySource = extractString(raw.source);
  if (!primarySource) {
    primarySource = normalizedRefs.length > 0 ? normalizedRefs[0].name : 'NVD';
  }

  // Derive ecosystem
  let primaryEcosystem = extractString(raw.ecosystem);
  if (!primaryEcosystem && raw.tags && raw.tags.length > 0) {
    primaryEcosystem = extractString(raw.tags[0], 'Security');
  }
  if (!primaryEcosystem) primaryEcosystem = 'Security';

  // Normalize remediation (handles string, object with fixed_version, array of objects, etc.)
  let remediationText = extractString(raw.remediation);
  if (!remediationText && raw.affected_components && Array.isArray(raw.affected_components) && raw.affected_components.length > 0) {
    const firstComp = raw.affected_components[0];
    if (typeof firstComp === 'object' && firstComp) {
      if (firstComp.fixed_version) {
        remediationText = `Upgrade ${firstComp.tech_name || 'package'} to ${firstComp.fixed_version}`;
      } else if (firstComp.raw_version_expression) {
        remediationText = `Affected version: ${firstComp.raw_version_expression}`;
      }
    }
  }
  if (!remediationText) {
    remediationText = normalizedRefs.length > 0 ? `See official reference: ${normalizedRefs[0].name}` : 'Review vendor security bulletin';
  }

  // Normalize affected components into array of safe objects
  const rawComponents = raw.affectedComponents || raw.affected_components || [];
  const affectedComponents = Array.isArray(rawComponents) && rawComponents.length > 0
    ? rawComponents.map((comp) => {
        if (typeof comp === 'string') {
          return { component: comp, affectedVersions: 'All versions', instance: primaryEcosystem, status: 'VULNERABLE' };
        }
        if (typeof comp === 'object' && comp) {
          return {
            component: extractString(comp.tech_name || comp.component || comp.name, displayId),
            affectedVersions: extractString(comp.raw_version_expression || comp.affectedVersions || (comp.fixed_version ? `< ${comp.fixed_version}` : 'See advisory')),
            instance: extractString(comp.ecosystem || comp.instance, primaryEcosystem),
            status: extractString(comp.status, 'VULNERABLE'),
          };
        }
        return { component: displayId, affectedVersions: 'See references', instance: primaryEcosystem, status: 'VULNERABLE' };
      })
    : [
        {
          component: displayId,
          affectedVersions: 'See references',
          instance: primaryEcosystem,
          status: 'VULNERABLE',
        },
      ];

  const titleText = extractString(raw.title, `${displayId} Security Advisory`);
  const severityText = extractString(raw.severity, 'MEDIUM').toUpperCase();

  return {
    id: displayId,
    uuid: extractString(raw.id, displayId),
    display_id: displayId,
    title: titleText,
    severity: severityText,
    cvss: typeof raw.cvss === 'number' ? raw.cvss : parseFloat(raw.cvss) || 7.5,
    cvssVersion: extractString(raw.cvssVersion, 'CVSS V3.1'),
    remediation: remediationText,
    ecosystem: primaryEcosystem,
    source: primarySource,
    date: formattedDate,
    published: formattedDate,
    lastUpdated: raw.lastUpdated ? formatDate(raw.lastUpdated) : formattedDate,
    status: extractString(raw.status, 'OPEN'),
    description: extractString(raw.description, `Security advisory ${displayId} published on ${formattedDate}. Details and patch info available in reference links.`),
    affectedComponents,
    references: normalizedRefs,
    tags: Array.isArray(raw.tags) ? raw.tags.map(t => extractString(t)) : [],
  };
}

function toISO(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * API 1: Fetch vulnerability list / search with query parameters
 * GET /api/v1/vulnerabilities/?severity=...&ecosystem=...&tech_name=...&page=...
 */
export async function fetchVulnerabilities({
  page = 1,
  limit = 6,
  query = '',
  severities = [],
  ecosystem = '',
  tech_name = '',
  startDate = '',
  endDate = '',
  sortBy = 'Date',
  sortDir = 'Descending',
} = {}) {
  const url = new URL(`${API_BASE_URL}/vulnerabilities/`);
  
  if (page) url.searchParams.append('page', page);
  if (limit) {
    url.searchParams.append('limit', limit);
    url.searchParams.append('page_size', limit);
  }
  if (query) url.searchParams.append('search', query);
  if (ecosystem) url.searchParams.append('ecosystem', ecosystem);
  if (tech_name) url.searchParams.append('tech_name', tech_name);
  if (startDate) url.searchParams.append('start_date', toISO(startDate));
  if (endDate) url.searchParams.append('end_date', toISO(endDate));
  if (severities && severities.length > 0) {
    severities.forEach((sev) => url.searchParams.append('severity', sev));
  }
  if (sortBy) {
    const sortPrefix = sortDir === 'Descending' ? '-' : '';
    const field = sortBy === 'Date' ? 'published_at' : 'cvss_score';
    url.searchParams.append('ordering', `${sortPrefix}${field}`);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // DRF Paginated Response: { count, next, previous, results }
    const results = (data.results || []).map(normalizeVulnerability);
    const count = data.count || results.length;
    
    return {
      results,
      count,
      next: data.next,
      previous: data.previous,
    };
  } catch (err) {
    console.error(`[Backend API Fetch Error] Failed to connect to ${url.toString()}:`, err);
    throw err;
  }
}

/**
 * API 2: Select specific vulnerability by display_id or UUID
 * GET /api/v1/vulnerabilities/{display_id}
 */
export async function fetchVulnerabilityById(displayId) {
  if (!displayId) return null;

  const url = `${API_BASE_URL}/vulnerabilities/${encodeURIComponent(displayId)}/`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return normalizeVulnerability(data);
  } catch (err) {
    console.error(`[Backend API Detail Error] Failed to fetch vulnerability '${displayId}' from ${url}:`, err);
    return null;
  }
}
