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

/** Normalizes a backend API vulnerability object into the shape expected by UI components */
export function normalizeVulnerability(raw) {
  if (!raw) return null;

  const displayId = raw.display_id || raw.id || 'CVE-UNKNOWN';
  const rawDate = raw.published_at || raw.date || raw.published;
  const formattedDate = formatDate(rawDate);

  // Normalize references: convert { id, url } or string to { id, name, url }
  const normalizedRefs = (raw.references || []).map((ref, idx) => {
    if (typeof ref === 'string') {
      return { id: idx, name: deriveReferenceName(ref), url: ref };
    }
    return {
      id: ref.id || idx,
      name: ref.name || deriveReferenceName(ref.url),
      url: ref.url || '#',
    };
  });

  // Extract source from references if source not explicitly provided
  const primarySource = raw.source || (normalizedRefs.length > 0 ? normalizedRefs[0].name : 'NVD');

  // Derive ecosystem from tags if available, or fallback
  const primaryEcosystem = raw.ecosystem || (raw.tags && raw.tags.length > 0 ? raw.tags[0] : 'Security');

  return {
    id: displayId,
    uuid: raw.id || displayId,
    display_id: displayId,
    title: raw.title || `${displayId} Security Advisory`,
    severity: (raw.severity || 'MEDIUM').toUpperCase(),
    cvss: raw.cvss !== undefined ? raw.cvss : 7.5,
    cvssVersion: raw.cvssVersion || 'CVSS V3.1',
    remediation: raw.remediation || (normalizedRefs.length > 0 ? `See official reference: ${normalizedRefs[0].name}` : 'Review vendor security bulletin'),
    ecosystem: primaryEcosystem,
    source: primarySource,
    date: formattedDate,
    published: formattedDate,
    lastUpdated: raw.lastUpdated ? formatDate(raw.lastUpdated) : formattedDate,
    status: raw.status || 'OPEN',
    description: raw.description || `Security advisory ${displayId} published on ${formattedDate}. Details and patch info available in reference links.`,
    affectedComponents: raw.affectedComponents || raw.affected_components || [
      {
        component: displayId,
        affectedVersions: 'See references',
        instance: primaryEcosystem,
        status: 'VULNERABLE',
      },
    ],
    references: normalizedRefs,
    tags: raw.tags || [],
  };
}

/**
 * API 1: Fetch vulnerability list / search with query parameters
 * GET /api/v1/vulnerabilities/?severity=...&ecosystem=...&tech_name=...&page=...
 */
export async function fetchVulnerabilities({
  page = 1,
  query = '',
  severities = [],
  ecosystem = '',
  tech_name = '',
  sortBy = 'Date',
  sortDir = 'Descending',
  limit = 6,
} = {}) {
  const url = new URL(`${API_BASE_URL}/vulnerabilities/`);
  
  if (page) url.searchParams.append('page', page);
  if (query) url.searchParams.append('search', query);
  if (ecosystem) url.searchParams.append('ecosystem', ecosystem);
  if (tech_name) url.searchParams.append('tech_name', tech_name);
  if (severities && severities.length > 0) {
    severities.forEach((sev) => url.searchParams.append('severity', sev));
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
