const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

/** Helper to format ISO date string, YYYY-MM-DD, or DD-MM-YYYY to 'DD MMM YYYY' */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const trimmed = String(dateString).trim();

  // Handle DD-MM-YYYY format e.g. "28-07-2026"
  const ddmmyyyyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${day} ${months[mIdx]} ${year}`;
    }
  }

  // Handle YYYY-MM-DD format e.g. "2026-07-28"
  const yyyymmddMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${day} ${months[mIdx]} ${year}`;
    }
  }

  try {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return trimmed;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch (e) {
    return trimmed;
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
  if (url.includes('patchstack.com')) return 'Patchstack';

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

  // Normalize references: convert string URL or { id, url } to { id, name, url }
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
    primarySource = normalizedRefs.length > 0 ? normalizedRefs[0].name : 'ThreatLens';
  }

  // Extract tech names
  const techNames = Array.isArray(raw.filter_tech_names) && raw.filter_tech_names.length > 0
    ? raw.filter_tech_names.map(t => extractString(t))
    : (raw.tech_name || raw.techName ? [extractString(raw.tech_name || raw.techName)] : []);
  const primaryTechName = techNames.length > 0 ? techNames[0] : '';

  // Derive ecosystem list (supporting multiple ecosystems)
  let rawEcosystems = [];
  if (Array.isArray(raw.filter_ecosystems) && raw.filter_ecosystems.length > 0) {
    rawEcosystems = raw.filter_ecosystems.map(e => extractString(e)).filter(Boolean);
  } else if (Array.isArray(raw.ecosystems) && raw.ecosystems.length > 0) {
    rawEcosystems = raw.ecosystems.map(e => extractString(e)).filter(Boolean);
  } else if (raw.ecosystem) {
    const str = extractString(raw.ecosystem);
    rawEcosystems = str.split(/[,;/]\s*/).map(s => s.trim()).filter(Boolean);
  }

  if (rawEcosystems.length === 0 && raw.tags && raw.tags.length > 0) {
    rawEcosystems = raw.tags.map(t => extractString(t)).filter(Boolean);
  }

  const ecosystems = [...new Set(rawEcosystems.length > 0 ? rawEcosystems : ['Security'])];
  const primaryEcosystem = ecosystems.join(', ');

  // Normalize description text
  let descriptionText = '';
  if (Array.isArray(raw.descriptions) && raw.descriptions.length > 0) {
    descriptionText = raw.descriptions.map(d => extractString(d)).join('\n\n');
  } else if (raw.description) {
    descriptionText = extractString(raw.description);
  }
  if (!descriptionText) {
    descriptionText = `Security advisory ${displayId} published on ${formattedDate}. Details and patch info available in reference links.`;
  }

  // Derive title text
  let titleText = extractString(raw.title);
  if (!titleText) {
    if (raw.descriptions && raw.descriptions.length > 0) {
      const firstDesc = extractString(raw.descriptions[0]);
      if (firstDesc) {
        titleText = firstDesc.length > 120 ? firstDesc.substring(0, 117) + '...' : firstDesc;
      }
    }
  }
  if (!titleText) {
    titleText = primaryTechName ? `${primaryTechName} Security Advisory` : `${displayId} Security Advisory`;
  }

  // Normalize remediation text
  let remediationText = '';
  if (Array.isArray(raw.vendor_remediations) && raw.vendor_remediations.length > 0) {
    remediationText = raw.vendor_remediations.map(r => extractString(r)).join('; ');
  } else if (raw.remediation) {
    remediationText = extractString(raw.remediation);
  }
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

  // Parse affected components array
  let affectedComponents = [];
  if (Array.isArray(raw.vulnerable_components) && raw.vulnerable_components.length > 0) {
    affectedComponents = raw.vulnerable_components.map((compStr) => {
      if (typeof compStr === 'string') {
        const parts = compStr.split(':');
        if (parts.length >= 3) {
          const compName = parts[0];
          const vers = parts[parts.length - 1];
          const inst = parts.slice(1, parts.length - 1).join(':');
          return { component: compName, affectedVersions: vers, instance: inst || primaryEcosystem, status: 'VULNERABLE' };
        }
        return { component: compStr, affectedVersions: 'See advisory', instance: primaryEcosystem, status: 'VULNERABLE' };
      }
      return { component: displayId, affectedVersions: 'See references', instance: primaryEcosystem, status: 'VULNERABLE' };
    });
  } else if (Array.isArray(raw.affectedComponents || raw.affected_components) && (raw.affectedComponents || raw.affected_components).length > 0) {
    const rawComps = raw.affectedComponents || raw.affected_components;
    affectedComponents = rawComps.map((comp) => {
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
    });
  } else {
    affectedComponents = [
      {
        component: primaryTechName || displayId,
        affectedVersions: 'See references',
        instance: primaryEcosystem,
        status: 'VULNERABLE',
      },
    ];
  }

  const severityText = extractString(raw.severity, 'MEDIUM').toUpperCase();
  let cvssVal = 7.5;
  if (typeof raw.cvss === 'number') {
    cvssVal = raw.cvss;
  } else if (typeof raw.cvss === 'string' && !isNaN(parseFloat(raw.cvss))) {
    cvssVal = parseFloat(raw.cvss);
  } else {
    if (severityText === 'CRITICAL') cvssVal = 9.5;
    else if (severityText === 'HIGH') cvssVal = 8.0;
    else if (severityText === 'MEDIUM') cvssVal = 6.0;
    else if (severityText === 'LOW') cvssVal = 3.5;
    else if (severityText === 'UNKNOWN') cvssVal = 'N/A';
  }

  return {
    id: displayId,
    uuid: extractString(raw.id, displayId),
    display_id: displayId,
    title: titleText,
    severity: severityText,
    cvss: cvssVal,
    cvssVersion: extractString(raw.cvssVersion, 'CVSS V3.1'),
    remediation: remediationText,
    ecosystem: primaryEcosystem,
    ecosystems: ecosystems,
    tech_name: primaryTechName,
    source: primarySource,
    date: formattedDate,
    published: formattedDate,
    lastUpdated: raw.lastUpdated ? formatDate(raw.lastUpdated) : formattedDate,
    status: extractString(raw.status, 'OPEN'),
    description: descriptionText,
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
 * API 1: Fetch master list (dashboard) OR search with filters
 * Master endpoint: GET /api/v1/vulnerabilities/?limit=...&page=...
 * Search endpoint: GET /api/v1/vulnerabilities/search/?q=...&tech_name=...&severity=...&ecosystem=...&start_date=...&end_date=...&sort=...
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
  const hasSearchOrFilters = Boolean(
    (query && query.trim()) ||
    (tech_name && tech_name.trim()) ||
    (ecosystem && ecosystem.trim()) ||
    (severities && severities.length > 0) ||
    (startDate && startDate.trim()) ||
    (endDate && endDate.trim())
  );

  const endpoint = hasSearchOrFilters ? `${API_BASE_URL}/vulnerabilities/search/` : `${API_BASE_URL}/vulnerabilities/`;
  const url = new URL(endpoint);

  if (page) url.searchParams.append('page', page);
  if (limit) {
    url.searchParams.append('limit', limit);
  }

  if (sortBy) {
    const field = sortBy === 'Date' ? 'published_at' : (sortBy === 'CVSS' ? 'cvss_score' : sortBy);
    const dir = sortDir === 'Ascending' ? 'asc' : 'desc';
    url.searchParams.append('sort', `${field}:${dir}`);
  }

  if (hasSearchOrFilters) {
    if (query && query.trim()) url.searchParams.append('q', query.trim());
    if (tech_name && tech_name.trim()) url.searchParams.append('tech_name', tech_name.trim());
    if (ecosystem && ecosystem.trim()) url.searchParams.append('ecosystem', ecosystem.trim());
    if (startDate && startDate.trim()) url.searchParams.append('start_date', toISO(startDate.trim()));
    if (endDate && endDate.trim()) url.searchParams.append('end_date', toISO(endDate.trim()));

    if (severities && severities.length > 0) {
      severities.forEach((sev) => {
        if (sev) url.searchParams.append('severity', sev);
      });
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 404) {
      // Backend returns HTTP 404 ("No MasterVulnerability matches the given query") when 0 results match
      return {
        results: [],
        count: 0,
        next: null,
        previous: null,
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const results = (data.results || []).map(normalizeVulnerability);
    const count = data.pagination?.total_records ?? data.count ?? results.length;

    return {
      results,
      count,
      next: data.pagination?.next_page ?? data.next ?? null,
      previous: data.pagination?.previous_page ?? data.previous ?? null,
    };
  } catch (err) {
    console.error(`[Backend API Fetch Error] Failed to connect to ${url.toString()}:`, err);
    throw err;
  }
}

/**
 * API 2: Select specific vulnerability by display_id or UUID
 * GET /api/v1/vulnerabilities/{display_id}/
 */
export async function fetchVulnerabilityById(displayId) {
  if (!displayId) return null;

  const url = `${API_BASE_URL}/vulnerabilities/${encodeURIComponent(displayId)}/`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 404) {
      return null;
    }

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

/**
 * API 3: View manual guidance (comments) for a vulnerability
 * GET /api/v1/vulnerabilities/{display_id}/remediations/
 */
export async function fetchManualGuidance(displayId) {
  if (!displayId) return [];

  const url = `${API_BASE_URL}/vulnerabilities/${encodeURIComponent(displayId)}/remediations/`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      id: item.id,
      author: item.author_name || item.author || 'Anonymous',
      description: item.guidance_text || item.description || '',
      timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
    }));
  } catch (err) {
    console.error(`[Manual Guidance Fetch Error] Failed to fetch remediations for '${displayId}' from ${url}:`, err);
    return [];
  }
}

/**
 * API 4: Create manual guidance (comment) for a vulnerability
 * POST /api/v1/vulnerabilities/{display_id}/remediations/
 */
export async function createManualGuidance(displayId, { author, description }) {
  if (!displayId) return null;

  const url = `${API_BASE_URL}/vulnerabilities/${encodeURIComponent(displayId)}/remediations/`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author_name: author,
        guidance_text: description,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const item = await response.json();
    return {
      id: item.id || `local-${Date.now()}`,
      author: item.author_name || author,
      description: item.guidance_text || description,
      timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
    };
  } catch (err) {
    console.error(`[Manual Guidance Create Error] Failed to post remediation for '${displayId}':`, err);
    return {
      id: `local-${Date.now()}`,
      author,
      description,
      timestamp: Date.now(),
    };
  }
}

/**
 * API 5: Edit manual guidance (comment)
 * PATCH /api/v1/remediations/{id}/
 */
export async function updateManualGuidance(id, guidanceText) {
  if (!id) return null;

  const url = `${API_BASE_URL}/remediations/${encodeURIComponent(id)}/`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guidance_text: guidanceText,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const item = await response.json();
    return {
      id: item.id || id,
      author: item.author_name,
      description: item.guidance_text || guidanceText,
      timestamp: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
    };
  } catch (err) {
    console.error(`[Manual Guidance Edit Error] Failed to patch remediation '${id}':`, err);
    return null;
  }
}

/**
 * API 6: Delete manual guidance (comment)
 * DELETE /api/v1/remediations/{id}/
 */
export async function deleteManualGuidance(id) {
  if (!id) return false;

  const url = `${API_BASE_URL}/remediations/${encodeURIComponent(id)}/`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 204) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    return true;
  } catch (err) {
    console.error(`[Manual Guidance Delete Error] Failed to delete remediation '${id}':`, err);
    return false;
  }
}

/** Authentication & Storage Helpers */
export function getAccessToken() {
  return localStorage.getItem('threatlens_access_token') || localStorage.getItem('access_token') || null;
}

export function getRefreshToken() {
  return localStorage.getItem('threatlens_refresh_token') || localStorage.getItem('refresh_token') || null;
}

export function setAuthTokens({ access, refresh, user }) {
  if (access) {
    localStorage.setItem('threatlens_access_token', access);
  }
  if (refresh) {
    localStorage.setItem('threatlens_refresh_token', refresh);
  }
  if (user) {
    localStorage.setItem('threatlens_user', JSON.stringify(user));
  }
}

export function clearAuthTokens() {
  localStorage.removeItem('threatlens_access_token');
  localStorage.removeItem('threatlens_refresh_token');
  localStorage.removeItem('threatlens_user');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('threatlens_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Step 2: POST /api/v1/auth/google/
 * Sends Google ID Token to backend for verification, domain check (@innovaturelabs.com), auto-provisioning & JWT minting
 */
export async function googleAuthLogin(credential) {
  if (!credential) {
    throw new Error('Google ID Token credential is required');
  }

  const url = `${API_BASE_URL}/auth/google/`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      let errorMessage = `Authentication failed (HTTP ${response.status})`;
      try {
        const errorData = await response.json();
        console.error('[Backend Auth Error Data]:', errorData);
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (Array.isArray(errorData.non_field_errors) && errorData.non_field_errors.length > 0) {
          errorMessage = errorData.non_field_errors.join(', ');
        } else if (typeof errorData === 'object') {
          errorMessage = Object.entries(errorData)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join(' | ');
        }
      } catch (e) {
        // Response was not JSON
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    setAuthTokens(data);
    return data;
  } catch (err) {
    console.error('[Google Auth API Error]:', err);
    throw err;
  }
}


/**
 * Step 5: POST /api/v1/auth/token/refresh/
 * Silent Session Renewal using stored refresh token
 */
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return null;
  }

  const url = `${API_BASE_URL}/auth/token/refresh/`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      clearAuthTokens();
      return null;
    }

    const data = await response.json();
    if (data.access) {
      localStorage.setItem('threatlens_access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('threatlens_refresh_token', data.refresh);
      }
      return data.access;
    }

    clearAuthTokens();
    return null;
  } catch (err) {
    console.error('[Token Refresh Error]:', err);
    clearAuthTokens();
    return null;
  }
}

/**
 * Step 4: GET /api/v1/auth/me/
 * Session Restore & User State Fetching using Authorization: Bearer <access_token>
 */
export async function fetchCurrentUser() {
  let token = getAccessToken();
  if (!token) return null;

  const url = `${API_BASE_URL}/auth/me/`;

  try {
    let response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    // Catch 401 Unauthorized for silent token renewal
    if (response.status === 401) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${newAccessToken}`,
          },
        });
      } else {
        return null;
      }
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAuthTokens();
        return null;
      }
      throw new Error(`HTTP error ${response.status}`);
    }

    const userData = await response.json();
    if (userData) {
      localStorage.setItem('threatlens_user', JSON.stringify(userData));
    }
    return userData;
  } catch (err) {
    console.error('[Fetch Current User Error]:', err);
    return null;
  }
}

/**
 * HTTP Interceptor Wrapper for authenticated requests
 */
export async function authenticatedFetch(url, options = {}) {
  let token = getAccessToken();
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && getRefreshToken()) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      headers['Authorization'] = `Bearer ${newAccessToken}`;
      response = await fetch(url, { ...options, headers });
    } else {
      clearAuthTokens();
    }
  }

  return response;
}


