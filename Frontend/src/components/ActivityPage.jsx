import React, { useState, useMemo } from 'react';
import { INITIAL_MOCK_ACTIVITIES, formatRelativeTime } from '../mock/activityData';
import Pagination from './Pagination';

const ThumbsUpIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
  </svg>
);

const ThumbsDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
  </svg>
);

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

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

export default function ActivityPage({
  currentUser = null,
  onSelectVuln = () => {},
  showToast = () => {},
  onNavigateHome = () => {},
}) {
  const [activities, setActivities] = useState(INITIAL_MOCK_ACTIVITIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL'); // 'ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'score'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Editing Comment State
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  // Confirm Delete ID state
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Deleting Comment ID state for animated exit
  const [deletingIds, setDeletingIds] = useState([]);

  // Derived current user metadata
  const currentUserName = currentUser?.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
    : (currentUser?.username || currentUser?.email?.split('@')[0] || 'Devon Vance');

  const currentUserEmail = currentUser?.email || 'devon.v@innovaturelabs.com';
  const currentUserRole = currentUser?.role || 'AppSec Team Lead';

  // Filter activities to strictly include only comments authored by the current logged-in user
  const userActivities = useMemo(() => {
    return activities.filter(
      (a) => a.is_current_user || (currentUserEmail && a.author_email === currentUserEmail)
    );
  }, [activities, currentUserEmail]);

  // Personal Stats calculation based on logged-in user's comments
  const stats = useMemo(() => {
    const total = userActivities.length;
    const reputation = userActivities.reduce((acc, a) => acc + (a.score || 0), 0);
    const uniqueAdvisories = new Set(userActivities.map(a => a.vuln_id)).size;
    return { total, reputation, uniqueAdvisories };
  }, [userActivities]);

  // Filter and sort user's activities
  const filteredActivities = useMemo(() => {
    return userActivities.filter((act) => {
      // Search text match
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        act.vuln_id.toLowerCase().includes(q) ||
        act.vuln_title.toLowerCase().includes(q) ||
        act.guidance_text.toLowerCase().includes(q) ||
        act.ecosystem.toLowerCase().includes(q)
      );

      if (!matchesQuery) return false;

      // Vulnerability Severity filter
      if (selectedSeverity !== 'ALL') {
        if ((act.severity || '').toUpperCase() !== selectedSeverity) {
          return false;
        }
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
  }, [userActivities, searchQuery, selectedSeverity, sortBy]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const displayedActivities = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return filteredActivities.slice(start, start + itemsPerPage);
  }, [filteredActivities, safePage, itemsPerPage]);

  // Vote handler for user's own comments
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
    showToast('Your suggestion has been updated', 'success');
  };

  // Delete activity comment with animation
  const handleDeleteActivity = (id) => {
    setDeletingIds((prev) => [...prev, id]);
    setTimeout(() => {
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setDeletingIds((prev) => prev.filter((d) => d !== id));
      showToast('Suggestion deleted from your log', 'info');
    }, 300);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col gap-6">
      {/* ── Personal User Banner & Header Bar ── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="h-8 px-2.5 rounded-[8px] border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-80 flex-shrink-0"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-card)',
              color: 'var(--text-primary)',
            }}
            title="Back to Advisories Search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back</span>
          </button>

          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-heading)' }}>
            My Activity
          </h1>
        </div>

        {/* User-Centric Personal Stat Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Stat 1: Total Suggestions */}
          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all shadow-xs hover:border-neutral-400 dark:hover:border-neutral-600"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Total Suggestions
              </span>
              <span
                className="text-[0.72rem] px-[8px] py-[2px] rounded-[5px] border font-medium inline-block"
                style={{
                  background: 'var(--bg-badge)',
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-card)',
                }}
              >
                Activity
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{stats.total}</span>
              <span className="text-[0.7rem] font-medium" style={{ color: 'var(--text-muted)' }}>
                Posted across advisories
              </span>
            </div>
          </div>

          {/* Stat 2: Net Upvotes */}
          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all shadow-xs hover:border-neutral-400 dark:hover:border-neutral-600"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Net Upvotes
              </span>
              <span
                className="text-[0.72rem] px-[8px] py-[2px] rounded-[5px] border font-medium inline-block"
                style={{
                  background: 'var(--bg-badge)',
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-card)',
                }}
              >
                Score
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>+{stats.reputation}</span>
              <span className="text-[0.7rem] font-medium" style={{ color: 'var(--text-muted)' }}>
                Upvotes earned on your notes
              </span>
            </div>
          </div>

          {/* Stat 3: Unique CVEs Covered */}
          <div
            className="p-3.5 rounded-[12px] border flex flex-col justify-between transition-all shadow-xs hover:border-neutral-400 dark:hover:border-neutral-600"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[0.75rem] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Unique CVEs
              </span>
              <span
                className="text-[0.72rem] px-[8px] py-[2px] rounded-[5px] border font-medium inline-block"
                style={{
                  background: 'var(--bg-badge)',
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-card)',
                }}
              >
                Coverage
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>{stats.uniqueAdvisories}</span>
              <span className="text-[0.7rem] font-medium" style={{ color: 'var(--text-muted)' }}>
                Distinct advisories with suggestions
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search & Tab Refinement Controls ── */}
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
            placeholder="Search your suggestions by CVE ID, title, or guidance text..."
            className="w-full h-9 pl-9 pr-8 rounded-[8px] border text-xs transition-all outline-none"
            style={{
              background: 'var(--bg-input)',
              borderColor: 'var(--border-input)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="absolute left-3 top-2.5 opacity-50" style={{ color: 'var(--text-primary)' }}>
            <SearchIcon />
          </span>
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

        {/* Severity Filter & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-2.5 justify-between lg:justify-end">
          {/* Severity Dropdown Filter */}
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <span>Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => { setSelectedSeverity(e.target.value); setCurrentPage(1); }}
              className="h-8 px-2 rounded-[6px] border text-xs font-semibold outline-none cursor-pointer"
              style={{
                background: 'var(--bg-input)',
                borderColor: 'var(--border-input)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
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

      {/* ── User Activity Feed List ── */}
      {filteredActivities.length === 0 ? (
        <div
          className="py-16 px-6 rounded-[14px] border text-center flex flex-col items-center gap-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
        >
          <span className="opacity-40" style={{ color: 'var(--text-primary)' }}>
            <FileTextIcon />
          </span>
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {userActivities.length === 0
              ? 'No Suggestions Authored Yet'
              : 'No Matching Suggestions Found'}
          </h3>
          <p className="text-xs max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
            {userActivities.length === 0
              ? 'You have not added any technical guidance or verification suggestions to advisories yet.'
              : 'No personal suggestions match your active search or severity filter. Try clearing your active filters.'}
          </p>
          {(searchQuery || selectedSeverity !== 'ALL') && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setSelectedSeverity('ALL'); }}
              className="mt-2 px-4 py-1.5 rounded-[8px] border text-xs font-semibold cursor-pointer"
              style={{ borderColor: 'var(--border-input)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <hr className="border-t mb-1 transition-colors duration-300" style={{ borderColor: 'var(--border-color)' }} />
          {displayedActivities.map((act, index) => {
            const isDeleting = deletingIds.includes(act.id);
            const isEditing = editingId === act.id;

            const sevLower = (act.severity || 'medium').toLowerCase();
            const badgeClass = `badge-${sevLower}`;

            return (
              <div
                key={act.id}
                className={`comment-item-wrapper ${isDeleting ? 'comment-item-deleting' : ''}`}
                style={isDeleting ? { animation: 'none' } : { animation: 'var(--animate-fade-slide-in)' }}
              >
                <div className="comment-item-inner">
                  <div
                    className="p-4 sm:p-4.5 rounded-[12px] border transition-all duration-200 shadow-xs flex flex-col gap-2"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-card)',
                    }}
                  >
                    {/* Header: Badges & Identifiers on Left, Upvote/Downvote on Right */}
                    <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                      {/* Left Metadata */}
                      <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                        {/* CVE Link Button */}
                        <button
                          type="button"
                          onClick={() => onSelectVuln(act.vuln_id)}
                          className="h-6 px-2 rounded-[6px] border text-[0.72rem] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all hover:opacity-80 flex-shrink-0"
                          style={{
                            background: 'var(--bg-secondary)',
                            borderColor: 'var(--border-input)',
                            color: 'var(--text-primary)',
                          }}
                          title={`Click to view advisory details for ${act.vuln_id}`}
                        >
                          <span>{act.vuln_id}</span>
                          <ExternalLinkIcon />
                        </button>

                        {/* Severity Chip */}
                        <span className={`px-2 py-0.5 rounded-[6px] text-[0.68rem] font-extrabold uppercase tracking-wide flex-shrink-0 ${badgeClass}`}>
                          {act.severity}
                        </span>

                        {/* Timestamp inline */}
                        <span className="text-[0.72rem] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                          {formatRelativeTime(act.timestamp)}
                          {act.is_edited && <span className="ml-1 font-medium opacity-80">(edited)</span>}
                        </span>
                      </div>

                      {/* Right Actions: Edit & Delete + Upvote / Downvote */}
                      <div className="flex items-center gap-1 flex-shrink-0 flex-nowrap">
                        {/* Inline Edit & Delete Controls */}
                        {!isEditing && (
                          confirmDeleteId === act.id ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs flex-shrink-0 animate-fade-in" style={{ background: 'var(--bg-badge)' }}>
                              <span className="text-[0.68rem] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                Delete note?
                              </span>
                              <button
                                type="button"
                                onClick={() => { setConfirmDeleteId(null); handleDeleteActivity(act.id); }}
                                className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold cursor-pointer border-0 text-white transition-opacity hover:opacity-90 flex-shrink-0"
                                style={{ background: '#ef4444' }}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer border-0 bg-transparent transition-colors flex-shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5 flex-shrink-0 mr-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(act)}
                                title="Edit note"
                                className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border-0 bg-transparent flex-shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-badge)'; e.currentTarget.style.color = 'var(--accent-blue)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              >
                                <EditIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(act.id)}
                                title="Delete note"
                                className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 border-0 bg-transparent flex-shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          )
                        )}

                        {/* Vertical Divider between Edit/Delete and Voting */}
                        {!isEditing && (
                          <div className="h-3.5 w-[1px] mx-1 flex-shrink-0" style={{ background: 'var(--border-color)' }} />
                        )}

                        {/* Upvote */}
                        <button
                          type="button"
                          onClick={() => handleVote(act.id, 1)}
                          title={act.user_vote === 1 ? 'Remove Upvote' : 'Upvote'}
                          className="flex items-center justify-center gap-1 min-w-[36px] px-1.5 py-0.5 text-xs font-semibold border-0 bg-transparent cursor-pointer transition-all duration-150 whitespace-nowrap active:scale-90 active:translate-y-[1px] select-none"
                          style={{
                            color: act.user_vote === 1 ? '#10b981' : 'var(--text-muted)',
                          }}
                          onMouseEnter={e => { if (act.user_vote !== 1) e.currentTarget.style.color = '#10b981'; }}
                          onMouseLeave={e => { if (act.user_vote !== 1) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <ThumbsUpIcon />
                          <span className="tabular-nums min-w-[12px] text-center inline-block">{act.upvotes || 0}</span>
                        </button>

                        {/* Downvote */}
                        <button
                          type="button"
                          onClick={() => handleVote(act.id, -1)}
                          title={act.user_vote === -1 ? 'Remove Downvote' : 'Downvote'}
                          className="flex items-center justify-center gap-1 min-w-[36px] px-1.5 py-0.5 text-xs font-semibold border-0 bg-transparent cursor-pointer transition-all duration-150 whitespace-nowrap active:scale-90 active:translate-y-[1px] select-none"
                          style={{
                            color: act.user_vote === -1 ? '#ef4444' : 'var(--text-muted)',
                          }}
                          onMouseEnter={e => { if (act.user_vote !== -1) e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={e => { if (act.user_vote !== -1) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <ThumbsDownIcon />
                          <span className="tabular-nums min-w-[12px] text-center inline-block">{act.downvotes || 0}</span>
                        </button>
                      </div>
                    </div>

                    {/* Body Content / Edit Textarea */}
                    {isEditing ? (
                      <div className="flex flex-col gap-2 pt-1">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 rounded-[8px] border-[1.5px] text-xs sm:text-[0.8rem] leading-relaxed outline-none resize-y"
                          style={{
                            background: 'var(--bg-input)',
                            borderColor: 'var(--border-input)',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="h-7 px-3 rounded-[6px] border text-xs font-semibold cursor-pointer"
                            style={{ borderColor: 'var(--border-input)', background: 'transparent', color: 'var(--text-secondary)' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(act.id)}
                            className="h-7 px-3 rounded-[6px] border-0 text-white text-xs font-semibold cursor-pointer"
                            style={{ background: 'var(--accent-blue)' }}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        className="text-xs sm:text-[0.8rem] leading-relaxed break-words whitespace-pre-wrap"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {act.guidance_text}
                      </p>
                    )}
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

    </div>
  );
}
