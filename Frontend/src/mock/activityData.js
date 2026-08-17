/**
 * Mock User Activity & Guidance Comments Dataset for ThreatLens
 * Simulates user comment logs across security advisories for the activity page.
 */

export const INITIAL_MOCK_ACTIVITIES = [
  {
    id: 'act-101',
    vuln_id: 'CVE-2024-3094',
    vuln_title: 'XZ Utils Backdoor in liblzma upstream tarballs',
    severity: 'CRITICAL',
    ecosystem: 'Linux / C',
    author_name: 'Alex Chen',
    author_email: 'alex.chen@innovaturelabs.com',
    author_role: 'Lead Security Engineer',
    guidance_text: 'Verified patch v5.6.1 in staging clusters. Ensure liblzma is upgraded immediately across Debian testing and Fedora raw-hide build servers. Disabling sshd direct systemd notify integration also mitigates payload execution in affected glibc environments.',
    score: 34,
    upvotes: 36,
    downvotes: 2,
    user_vote: 1,
    is_edited: true,
    is_current_user: false,
    created_at: '2026-08-17T08:15:00Z',
    timestamp: Date.now() - 1000 * 60 * 45, // 45 minutes ago
  },
  {
    id: 'act-102',
    vuln_id: 'CVE-2024-21626',
    vuln_title: 'runc container breakout via file descriptor leak in workdir',
    severity: 'HIGH',
    ecosystem: 'Docker / Go',
    author_name: 'Sarah Jenkins',
    author_email: 'sarah.j@innovaturelabs.com',
    author_role: 'DevOps Security Specialist',
    guidance_text: 'Audit custom Dockerfiles that use WORKDIR directive pointing to /proc/self/fd paths. Upgrading runc to 1.1.12 isolates container process descriptors during exec sessions.',
    score: 22,
    upvotes: 23,
    downvotes: 1,
    user_vote: 0,
    is_edited: false,
    is_current_user: false,
    created_at: '2026-08-16T17:30:00Z',
    timestamp: Date.now() - 1000 * 60 * 60 * 16, // 16 hours ago
  },
  {
    id: 'act-103',
    vuln_id: 'CVE-2023-4863',
    vuln_title: 'Heap buffer overflow in libwebp during WebP lossy decoding',
    severity: 'CRITICAL',
    ecosystem: 'Chromium / C++',
    author_name: 'Devon Vance',
    author_email: 'devon.v@innovaturelabs.com',
    author_role: 'AppSec Team Lead',
    guidance_text: 'For Electron applications in our repo, ensure electron dependency is updated to v26.2.4+. Node.js microservices using sharp or canvas packages must re-link against libwebp 1.3.2.',
    score: 19,
    upvotes: 20,
    downvotes: 1,
    user_vote: 0,
    is_edited: false,
    is_current_user: true,
    created_at: '2026-08-16T11:05:00Z',
    timestamp: Date.now() - 1000 * 60 * 60 * 22, // 22 hours ago
  },
  {
    id: 'act-104',
    vuln_id: 'GHSA-4h42-c54w-32m8',
    vuln_title: 'Express.js query parser prototype pollution risk in nested objects',
    severity: 'MEDIUM',
    ecosystem: 'npm / Node.js',
    author_name: 'Marcus Miller',
    author_email: 'marcus.m@innovaturelabs.com',
    author_role: 'Backend Architect',
    guidance_text: 'Configure app.set("query parser", "simple") in Express app initialization as a temporary mitigation until qs dependency is patched to v6.11.2 across API gateway services.',
    score: 15,
    upvotes: 16,
    downvotes: 1,
    user_vote: 0,
    is_edited: false,
    is_current_user: false,
    created_at: '2026-08-15T14:40:00Z',
    timestamp: Date.now() - 1000 * 60 * 60 * 42, // 42 hours ago
  },
  {
    id: 'act-105',
    vuln_id: 'CVE-2024-38810',
    vuln_title: 'Spring Framework Path Traversal Vulnerability in Static Resources',
    severity: 'HIGH',
    ecosystem: 'Maven / Java',
    author_name: 'Elena Rostova',
    author_email: 'elena.r@innovaturelabs.com',
    author_role: 'Senior Java Security Engineer',
    guidance_text: 'Check custom WebMvcConfigurer beans that handle static resource locations. Update Spring Framework to 6.1.13 or 5.3.39. Ensure RouterFunction specs clean URI paths.',
    score: 11,
    upvotes: 11,
    downvotes: 0,
    user_vote: 0,
    is_edited: true,
    is_current_user: false,
    created_at: '2026-08-14T09:20:00Z',
    timestamp: Date.now() - 1000 * 60 * 60 * 70, // ~3 days ago
  },
  {
    id: 'act-106',
    vuln_id: 'CVE-2024-27351',
    vuln_title: 'Django Regular Expression Denial of Service in django.utils.text',
    severity: 'LOW',
    ecosystem: 'PyPI / Python',
    author_name: 'Devon Vance',
    author_email: 'devon.v@innovaturelabs.com',
    author_role: 'AppSec Team Lead',
    guidance_text: 'Applied django==5.0.3 hotfix in production API server requirements.txt. Truncate user input string lengths passed into slugify() before rendering preview cards.',
    score: 8,
    upvotes: 9,
    downvotes: 1,
    user_vote: 1,
    is_edited: false,
    is_current_user: true,
    created_at: '2026-08-13T16:00:00Z',
    timestamp: Date.now() - 1000 * 60 * 60 * 88, // ~3.5 days ago
  },
];

/** Helper to format relative time strings */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const diffMs = now - (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
