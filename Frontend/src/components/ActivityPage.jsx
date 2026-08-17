import React, { useState, useMemo } from 'react';
import { INITIAL_MOCK_ACTIVITIES, formatRelativeTime } from '../mock/activityData';
import Pagination from './Pagination';

const UpvoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const DownvoteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
);

const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export default function ActivityPage({
  currentUser = null,
  onSelectVuln = () => {},
  showToast = () => {},
}) {
  const [activities, setActivities] = useState(INITIAL_MOCK_ACTIVITIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'my', 'top', 'critical'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'score'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // New Comment Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVulnId, setNewVulnId] = useState('CVE-2024-3094');
  const [newVulnTitle, setNewVulnTitle] = useState('XZ Utils Backdoor in liblzma upstream tarballs');
  const [newSeverity, setNewSeverity] = useState('HIGH');
  const [newEcosystem, setNewEcosystem] = useState('npm');
  const [newGuidanceText, setNewGuidanceText] = useState('');

  // Editing Comment State
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Deleting Comment ID state for animated exit
  const [deletingIds, setDeletingIds] = useState([]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = activities.length;
    const highImpact = activities.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;
    const totalScore = activities.reduce((acc, a) => acc + (a.score || 0), 0);
    const myComments = activities.filter(a => a.is_current_user || (currentUser?.email && a.author_email === currentUser.email)).length;
    return { total, highImpact, totalScore, myComments };
  }, [activities, currentUser]);

  // Derived current user display name
  const currentUserName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
    : (currentUser?.username || currentUser?.email?.split('@')[0] || 'Devon Vance');

  const currentUserEmail = currentUser?.email || 'devon.v@innovaturelabs.com';

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Search text match
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        act.vuln_id.toLowerCase().includes(q) ||
        act.vuln_title.toLowerCase().includes(q) ||
        act.author_name.toLowerCase().includes(q) ||
        act.guidance_text.toLowerCase().includes(q) ||
        act.ecosystem.toLowerCase().includes(q)
      );

      if (!matchesQuery) return false;

      // Filter tab
      if (filterTab === 'my') {
        return act.is_current_user || act.author_email === currentUserEmail;
      }
      if (filterTab === 'top') {
        return act.score >= 15;
      }
      if (filterTab === 'critical') {
        return act.severity === 'CRITICAL' || act.severity === 'HIGH';
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return b.timestamp - a.timestamp;
      }
      if (sortBy === 'oldest') {
        return a.timestamp - b.timestamp;
      }
      if (sortBy === 'score') {
        return b.score - a.score;
      }
      return 0;
    });
  }, [activities, searchQuery, filterTab, sortBy, currentUserEmail]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const displayedActivities = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredActivities.slice(start, start + itemsPerPage);
  }, [filteredActivities, safePage, itemsPerPage]);

  // Vote handler
  const handleVote = (id, direction) => {
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id !== id) return act;
        let newVote = direction;
        let scoreDelta = direction;

        if (act.user_vote === direction) {
          // Cancel vote
          newVote = 0;
          scoreDelta = -direction;
        } else if (act.user_vote !== 0) {
          // Switching vote direction
          scoreDelta = direction * 2;
        }

        const nextScore = act.score + scoreDelta;
        const nextUpvotes = act.upvotes + (newVote === 1 ? 1 : (act.user_vote === 1 ? -1 : 0));
        const nextDownvotes = act.downvotes + (newVote === -1 ? 1 : (act.user_vote === -1 ? -1 : 0));

        showToast(
          newVote === 1 ? 'Upvoted remediation comment' : (newVote === -1 ? 'Downvoted remediation comment' : 'Removed vote'),
          'info'
        );

        return {
          ...act,
          score: nextScore,
          upvotes: Math.max(0, nextUpvotes),
          downvotes: Math.max(0, nextDownvotes),
          user_vote: newVote,
        };
      })
    );
  };

  // Add new comment activity
  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!newGuidanceText.trim()) return;

    const newActivity = {
      id: `act-${Date.now()}`,
      vuln_id: newVulnId.trim().toUpperCase() || 'CVE-2024-3094',
      vuln_title: newVulnTitle.trim() || 'Security Advisory Comment',
      severity: newSeverity,
      ecosystem: newEcosystem,
      author_name: currentUserName,
      author_email: currentUserEmail,
      author_role: 'Security Engineer',
      guidance_text: newGuidanceText.trim(),
      score: 1,
      upvotes: 1,
      downvotes: 0,
      user_vote: 1,
      is_edited: false,
      is_current_user: true,
      created_at: new Date().toISOString(),
      timestamp: Date.now(),
    };

    setActivities((prev) => [newActivity, ...prev]);
    setNewGuidanceText('');
    setShowAddModal(false);
    showToast('Activity comment added successfully', 'success');
  };

  // Start inline editing
  const handleStartEdit = (act) => {
    setEditingId(act.id);
    setEditText(act.guidance_text);
  };

  // Save edit
  const handleSaveEdit = (id) => {
    if (!editText.trim()) return;
    setActivities((prev) =>
      prev.map((act) => {
        if (act.id !== id) return act;
        return {
          ...act,
          guidance_text: editText.trim(),
          is_edited: true,
        };
      })
    );
    setEditingId(null);
    setEditText('');
    showToast('Comment updated', 'success');
  };

  // Delete activity comment with animation
  const handleDeleteActivity = (id) => {
    setDeletingIds((prev) => [...prev, id]);
    setTimeout(() => {
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setDeletingIds((prev) => prev.filter((d) => d !== id));
      showToast('Comment activity deleted', 'info');
    }, 300);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col gap-6">
      {/* ── Page Header & Stats Summary Bar ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xl">💬</span>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-heading)' }}>
                User Activity & Comment Tracking
              </h1>
            </div>
            <p className="text-sm mt-1 max-w-[650px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Track technical remediation notes, verification logs, and community comments across ThreatLens vulnerability advisories.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-[10px] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 shadow-sm border-0 self-start sm:self-auto active:scale-[0.98]"
            style={{
              background: 'var(--accent-blue)',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-blue-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-blue)'; }}
          >
            <PlusIcon />
            <span>Post Activity Note</span>
          </button>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <span className="text-[0.75rem] font-medium" style={{ color: 'var(--text-muted)' }}>Total Activities</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{stats.total}</span>
              <span className="text-[0.7rem] font-semibold text-emerald-500">Live feed</span>
            </div>
          </div>

          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <span className="text-[0.75rem] font-medium" style={{ color: 'var(--text-muted)' }}>High-Impact Guidance</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-amber-500">{stats.highImpact}</span>
              <span className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>Crit / High CVEs</span>
            </div>
          </div>

          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <span className="text-[0.75rem] font-medium" style={{ color: 'var(--text-muted)' }}>Total Upvotes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold" style={{ color: 'var(--accent-blue)' }}>+{stats.totalScore}</span>
              <span className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>Reputation score</span>
            </div>
          </div>

          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <span className="text-[0.75rem] font-medium" style={{ color: 'var(--text-muted)' }}>My Annotations</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{stats.myComments}</span>
              <span className="text-[0.7rem]" style={{ color: 'var(--text-secondary)' }}>Authored by you</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <div
        className="p-4 rounded-[14px] border flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-xs"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
      >
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search activities by CVE ID, title, author, or guidance..."
            className="w-full h-9 pl-9 pr-8 rounded-[8px] border text-xs transition-all outline-none"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="absolute left-3 top-2.5 text-xs opacity-50">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs opacity-60 hover:opacity-100 cursor-pointer border-0 bg-transparent"
              style={{ color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Segmented Filter Tabs & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5 justify-between lg:justify-end">
          {/* Tabs */}
          <div
            className="p-1 rounded-[8px] border flex items-center gap-1 text-xs font-semibold"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            {[
              { id: 'all', label: 'All Activity' },
              { id: 'my', label: 'My Comments' },
              { id: 'top', label: 'Top Voted' },
              { id: 'critical', label: 'High Impact' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setFilterTab(tab.id); setCurrentPage(1); }}
                className="px-2.5 py-1 rounded-[6px] transition-all cursor-pointer border-0"
                style={{
                  background: filterTab === tab.id ? 'var(--bg-card)' : 'transparent',
                  color: filterTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: filterTab === tab.id ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="h-8 px-2 rounded-[6px] border text-xs font-semibold outline-none cursor-pointer"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="score">Highest Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Activity Feed List ── */}
      {filteredActivities.length === 0 ? (
        <div
          className="py-16 px-6 rounded-[14px] border text-center flex flex-col items-center gap-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
        >
          <span className="text-4xl">💬</span>
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No Activity Comments Found</h3>
          <p className="text-xs max-w-[400px]" style={{ color: 'var(--text-secondary)' }}>
            No comments match your active search or tab filter. Try adjusting your query or posting a new activity note.
          </p>
          {(searchQuery || filterTab !== 'all') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setFilterTab('all'); }}
              className="mt-2 px-4 py-1.5 rounded-[8px] border text-xs font-semibold cursor-pointer"
              style={{ borderColor: 'var(--border-input)', background: 'var(--bg-secondary)', color: 'var(--accent-blue)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {displayedActivities.map((act) => {
            const isDeleting = deletingIds.includes(act.id);
            const isEditing = editingId === act.id;
            const isAuthor = act.is_current_user || act.author_email === currentUserEmail;

            // Get badge severity class
            const sevLower = (act.severity || 'medium').toLowerCase();
            const badgeClass = `badge-${sevLower}`;

            return (
              <div
                key={act.id}
                className={`comment-item-wrapper ${isDeleting ? 'comment-item-deleting' : ''}`}
              >
                <div className="comment-item-inner">
                  <div
                    className="p-4 sm:p-5 rounded-[14px] border transition-all duration-200 shadow-xs flex flex-col gap-3"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-card)',
                    }}
                  >
                    {/* Activity Item Header: Author Info, Timestamp, CVE & Severity */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {/* Left: Author details */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center uppercase shadow-xs transition-colors duration-300 flex-shrink-0"
                          style={{
                            background: isAuthor ? 'var(--user-avatar-bg)' : 'var(--avatar-bg)',
                            color: isAuthor ? 'var(--user-avatar-text)' : 'var(--avatar-text)',
                          }}
                        >
                          {(act.author_name?.[0] || 'U').toUpperCase()}
                        </div>

                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                              {act.author_name}
                            </span>
                            {isAuthor && (
                              <span
                                className="px-1.5 py-0.5 rounded-[4px] text-[0.65rem] font-bold uppercase tracking-wider"
                                style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }}
                              >
                                You
                              </span>
                            )}
                            <span className="text-[0.72rem] font-medium" style={{ color: 'var(--text-muted)' }}>
                              • {formatRelativeTime(act.timestamp)}
                            </span>
                            {act.is_edited && (
                              <span className="text-[0.68rem] italic" style={{ color: 'var(--text-muted)' }}>
                                (edited)
                              </span>
                            )}
                          </div>
                          <span className="text-[0.72rem]" style={{ color: 'var(--text-secondary)' }}>
                            {act.author_role || act.author_email}
                          </span>
                        </div>
                      </div>

                      {/* Right: Advisory & Severity Badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Severity chip */}
                        <span className={`px-2 py-0.5 rounded-[6px] text-[0.68rem] font-extrabold uppercase tracking-wide ${badgeClass}`}>
                          {act.severity}
                        </span>

                        {/* CVE Button linking to advisory detail */}
                        <button
                          type="button"
                          onClick={() => onSelectVuln(act.vuln_id)}
                          className="h-6 px-2 rounded-[6px] border text-[0.72rem] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all hover:opacity-80"
                          style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border-input)',
                            color: 'var(--accent-blue)',
                          }}
                          title={`Click to view advisory details for ${act.vuln_id}`}
                        >
                          <span>{act.vuln_id}</span>
                          <ExternalLinkIcon />
                        </button>
                      </div>
                    </div>

                    {/* Advisory Title Context Line */}
                    <div className="text-xs font-medium flex items-center gap-1.5 opacity-90" style={{ color: 'var(--text-secondary)' }}>
                      <span>Ref:</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{act.vuln_title}</span>
                      <span className="text-[0.68rem] px-1.5 py-0.2 rounded" style={{ background: 'var(--bg-badge)', color: 'var(--text-muted)' }}>
                        {act.ecosystem}
                      </span>
                    </div>

                    {/* Guidance Text or Inline Edit Form */}
                    {isEditing ? (
                      <div className="flex flex-col gap-2 pt-1">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="w-full p-2.5 rounded-[8px] border text-xs leading-relaxed outline-none resize-y"
                          style={{
                            background: 'var(--bg-input)',
                            borderColor: 'var(--accent-blue)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 rounded-[6px] text-xs font-medium border cursor-pointer"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(act.id)}
                            className="px-3 py-1 rounded-[6px] text-xs font-bold text-white cursor-pointer border-0"
                            style={{ background: 'var(--accent-blue)' }}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="p-3 rounded-[10px] text-xs leading-relaxed transition-colors border"
                        style={{
                          background: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {act.guidance_text}
                      </div>
                    )}

                    {/* Footer Actions: Votes & Author Controls */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      {/* Vote Score Pill */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleVote(act.id, 1)}
                          className="h-7 px-2 rounded-[6px] border text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          style={{
                            borderColor: act.user_vote === 1 ? 'rgba(37, 99, 235, 0.4)' : 'var(--border-color)',
                            background: act.user_vote === 1 ? 'var(--accent-blue-light)' : 'var(--bg-secondary)',
                            color: act.user_vote === 1 ? 'var(--accent-blue)' : 'var(--text-secondary)',
                          }}
                          title="Upvote guidance note"
                        >
                          <UpvoteIcon />
                          <span>{act.upvotes}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleVote(act.id, -1)}
                          className="h-7 px-2 rounded-[6px] border text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          style={{
                            borderColor: act.user_vote === -1 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)',
                            background: act.user_vote === -1 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-secondary)',
                            color: act.user_vote === -1 ? '#ef4444' : 'var(--text-secondary)',
                          }}
                          title="Downvote guidance note"
                        >
                          <DownvoteIcon />
                          <span>{act.downvotes}</span>
                        </button>

                        <span className="ml-1 text-[0.72rem] font-semibold" style={{ color: 'var(--text-muted)' }}>
                          Score: <strong style={{ color: act.score >= 0 ? 'var(--text-primary)' : '#ef4444' }}>{act.score}</strong>
                        </span>
                      </div>

                      {/* Author Edit/Delete Buttons */}
                      {isAuthor && !isEditing && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(act)}
                            className="h-7 px-2 rounded-[6px] border text-[0.72rem] font-medium flex items-center gap-1 cursor-pointer transition-all hover:border-blue-500 hover:text-blue-500"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'transparent' }}
                            title="Edit this comment"
                          >
                            <EditIcon />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="h-7 px-2 rounded-[6px] border text-[0.72rem] font-medium flex items-center gap-1 cursor-pointer transition-all hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'transparent' }}
                            title="Delete this comment"
                          >
                            <DeleteIcon />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredActivities.length > itemsPerPage && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          cardsPerPage={itemsPerPage}
          onCardsPerPageChange={(newLimit) => { setItemsPerPage(newLimit); setCurrentPage(1); }}
          onPageChange={(p) => setCurrentPage(p)}
        />
      )}

      {/* ── Post New Activity Note Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div
            className="w-full max-w-[500px] rounded-[16px] border p-6 shadow-2xl animate-fade-slide-in flex flex-col gap-4"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-card)',
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <span className="text-lg">✏️</span>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Post Advisory Activity Note</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-xs opacity-60 hover:opacity-100 cursor-pointer border-0 bg-transparent"
                style={{ color: 'var(--text-secondary)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Vulnerability ID (CVE)</label>
                  <input
                    type="text"
                    required
                    value={newVulnId}
                    onChange={(e) => setNewVulnId(e.target.value)}
                    placeholder="e.g. CVE-2024-3094"
                    className="h-9 px-3 rounded-[8px] border text-xs font-mono outline-none"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="h-9 px-2.5 rounded-[8px] border text-xs font-bold outline-none cursor-pointer"
                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Advisory Title / Tech Summary</label>
                <input
                  type="text"
                  required
                  value={newVulnTitle}
                  onChange={(e) => setNewVulnTitle(e.target.value)}
                  placeholder="e.g. XZ Utils Backdoor in liblzma upstream"
                  className="h-9 px-3 rounded-[8px] border text-xs outline-none"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Remediation Guidance / Verification Comment</label>
                <textarea
                  required
                  rows={4}
                  value={newGuidanceText}
                  onChange={(e) => setNewGuidanceText(e.target.value)}
                  placeholder="Describe patch validation steps, mitigation workarounds, or deployment advice..."
                  className="w-full p-3 rounded-[8px] border text-xs leading-relaxed outline-none resize-y"
                  style={{ background: 'var(--bg-input)', borderColor: 'var(--border-input)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-[8px] text-xs font-semibold border cursor-pointer"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'transparent' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[8px] text-xs font-bold text-white cursor-pointer border-0 shadow-sm"
                  style={{ background: 'var(--accent-blue)' }}
                >
                  Post Activity Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
