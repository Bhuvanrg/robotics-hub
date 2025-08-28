import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Clock, User, ChevronRight, Bookmark } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  fetchForumThreadsPage,
  createForumThread,
  subscribeToNewThreads,
} from '@/services/forumThreads';
import { Skeleton } from './ui/skeleton';
import { withToast } from '@/lib/notify';
import { toggleSaveItem, getSavedItems } from '@/services/engagement';

// Mock forum threads data (expanded)
const mockThreads = [
  {
    id: 1,
    title: 'Help with PID Controller Tuning',
    category: 'Programming',
    author: 'Jake Wilson',
    authorTeam: 'Circuit Breakers',
    lastReply: '30min ago',
    lastReplyDate: new Date('2025-01-15T14:30:00'),
    replies: 12,
    views: 89,
    isAnswered: false,
    isPinned: false,
    tags: ['PID', 'Control', 'Help'],
    preview:
      "I'm struggling with tuning our drivetrain PID controller. The robot oscillates too much...",
  },
  {
    id: 2,
    title: 'Best Materials for Competition Robot Frame?',
    category: 'Mechanical',
    author: 'Lisa Chen',
    authorTeam: 'Steel Eagles',
    lastReply: '1h ago',
    lastReplyDate: new Date('2025-01-15T13:00:00'),
    replies: 8,
    views: 156,
    isAnswered: true,
    isPinned: false,
    tags: ['Materials', 'Frame', 'Mechanical'],
    preview: "We're deciding between aluminum and steel for our robot frame this season...",
  },
  {
    id: 3,
    title: '[PINNED] Welcome to the Forums - Please Read',
    category: 'General',
    author: 'Forum Admin',
    authorTeam: 'Moderator',
    lastReply: '2h ago',
    lastReplyDate: new Date('2025-01-15T12:00:00'),
    replies: 15,
    views: 412,
    isAnswered: false,
    isPinned: true,
    tags: ['Rules', 'Welcome'],
    preview: 'Welcome to our robotics community forums! Please read these guidelines...',
  },
  {
    id: 4,
    title: 'Vision Processing with OpenCV - Getting Started',
    category: 'Programming',
    author: 'David Park',
    authorTeam: 'Code Crusaders',
    lastReply: '2h ago',
    lastReplyDate: new Date('2025-01-15T12:00:00'),
    replies: 15,
    views: 203,
    isAnswered: false,
    isPinned: false,
    tags: ['OpenCV', 'Vision', 'Tutorial'],
    preview: 'New to computer vision programming. Can anyone recommend good tutorials for OpenCV?',
  },
  {
    id: 5,
    title: 'Wiring Best Practices for FRC Robots',
    category: 'Electronics',
    author: 'Amanda Rivera',
    authorTeam: 'Voltage Vipers',
    lastReply: '3h ago',
    lastReplyDate: new Date('2025-01-15T11:00:00'),
    replies: 6,
    views: 78,
    isAnswered: true,
    isPinned: false,
    tags: ['Wiring', 'FRC', 'Best Practices'],
    preview: 'What are the most important wiring practices to follow for FRC competition robots?',
  },
  {
    id: 6,
    title: 'How to Mentor Younger Team Members?',
    category: 'General',
    author: 'Coach Martinez',
    authorTeam: 'Mentor',
    lastReply: '4h ago',
    lastReplyDate: new Date('2025-01-15T10:00:00'),
    replies: 9,
    views: 134,
    isAnswered: false,
    isPinned: false,
    tags: ['Mentoring', 'Teaching', 'Leadership'],
    preview: 'Looking for advice on effectively mentoring rookie team members...',
  },
  {
    id: 7,
    title: 'Sensor Fusion for Autonomous Navigation',
    category: 'Programming',
    author: 'Dr. Sarah Kim',
    authorTeam: 'University Mentor',
    lastReply: '5h ago',
    lastReplyDate: new Date('2025-01-15T09:00:00'),
    replies: 23,
    views: 298,
    isAnswered: true,
    isPinned: false,
    tags: ['Sensors', 'Autonomous', 'Navigation'],
    preview: 'Combining gyro, encoder, and vision data for reliable autonomous navigation...',
  },
];

const categories = [
  { id: 'all', name: 'All Categories', color: 'bg-gray-500' },
  { id: 'programming', name: 'Programming', color: 'bg-blue-500' },
  { id: 'mechanical', name: 'Mechanical', color: 'bg-green-500' },
  { id: 'electronics', name: 'Electronics', color: 'bg-yellow-500' },
  { id: 'general', name: 'General', color: 'bg-purple-500' },
];

const sortOptions = [
  { id: 'recent', label: 'Recent Activity' },
  { id: 'newest', label: 'Newest Threads' },
  { id: 'replies', label: 'Most Replies' },
  { id: 'views', label: 'Most Views' },
  { id: 'unanswered', label: 'Unanswered First' },
];

interface Thread {
  id: number;
  title: string;
  category: string;
  author: string;
  authorTeam: string;
  lastReply: string;
  lastReplyDate: Date;
  replies: number;
  views: number;
  isAnswered: boolean;
  isPinned: boolean;
  tags: string[];
  preview: string;
}

interface ThreadWithAvatar extends Thread {
  avatar_url?: string | null;
}

interface ForumsUser {
  id?: string;
  user_metadata?: { full_name?: string };
}

interface ServiceThreadRecord {
  id: number;
  author_id: string | null;
  title: string;
  body: string;
  category: string;
  tags: string[] | null;
  reply_count: number;
  view_count: number;
  answered_reply_id: number | null;
  is_pinned: boolean;
  last_activity_at: string;
  created_at: string;
  author_profile?: { user_id: string; display_name: string | null; team: string | null };
}

export function Forums({ user }: { user?: ForumsUser }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [threads, setThreads] = useState<ThreadWithAvatar[]>(mockThreads);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('recent');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const [hasMore, setHasMore] = useState(true);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  // Filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get unique filter options
  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    threads.forEach((thread) => {
      thread.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts).map(([tag, count]) => ({
      id: tag,
      label: tag,
      count,
    }));
  }, [threads]);

  const statusOptions = useMemo(
    () => [
      { id: 'answered', label: 'Answered', count: threads.filter((t) => t.isAnswered).length },
      { id: 'unanswered', label: 'Unanswered', count: threads.filter((t) => !t.isAnswered).length },
      { id: 'pinned', label: 'Pinned', count: threads.filter((t) => t.isPinned).length },
    ],
    [threads]
  );

  // Filter and sort threads
  const filteredThreads = useMemo(() => {
    const filtered = threads.filter((thread) => {
      // Category filter
      if (selectedCategory !== 'all' && thread.category.toLowerCase() !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = thread.title.toLowerCase().includes(query);
        const matchesContent = thread.preview.toLowerCase().includes(query);
        const matchesAuthor = thread.author.toLowerCase().includes(query);
        const matchesTags = thread.tags?.some((tag) => tag.toLowerCase().includes(query));

        if (!matchesTitle && !matchesContent && !matchesAuthor && !matchesTags) {
          return false;
        }
      }

      // Status filters
      if (selectedStatuses.length > 0) {
        let matchesStatus = false;
        if (selectedStatuses.includes('answered') && thread.isAnswered) matchesStatus = true;
        if (selectedStatuses.includes('unanswered') && !thread.isAnswered) matchesStatus = true;
        if (selectedStatuses.includes('pinned') && thread.isPinned) matchesStatus = true;
        if (!matchesStatus) return false;
      }

      // Tags filter
      if (selectedTags.length > 0) {
        const hasSelectedTags = selectedTags.some((tag) => thread.tags?.includes(tag));
        if (!hasSelectedTags) return false;
      }

      return true;
    });

    // Sort threads
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => b.id - a.id);
        break;
      case 'replies':
        filtered.sort((a, b) => b.replies - a.replies);
        break;
      case 'views':
        filtered.sort((a, b) => b.views - a.views);
        break;
      case 'unanswered':
        filtered.sort((a, b) => {
          if (a.isAnswered && !b.isAnswered) return 1;
          if (!a.isAnswered && b.isAnswered) return -1;
          return b.lastReplyDate.getTime() - a.lastReplyDate.getTime();
        });
        break;
      default: // recent
        // Pinned threads first, then by last reply time
        filtered.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.lastReplyDate.getTime() - a.lastReplyDate.getTime();
        });
    }

    return filtered;
  }, [threads, selectedCategory, searchQuery, selectedStatuses, selectedTags, sortBy]);

  // Get active filters
  const activeFilters: string[] = useMemo(() => {
    const filters: string[] = [];
    if (selectedCategory !== 'all') {
      const category = categories.find((c) => c.id === selectedCategory);
      if (category) filters.push(category.name);
    }
    if (selectedStatuses.length > 0) {
      filters.push(
        ...selectedStatuses
          .map((s) => statusOptions.find((opt) => opt.id === s)?.label)
          .filter((v): v is string => Boolean(v))
      );
    }
    if (selectedTags.length > 0) filters.push(...selectedTags);
    return filters;
  }, [selectedCategory, selectedStatuses, selectedTags, statusOptions]);

  const filterSections = [
    {
      id: 'status',
      title: 'Thread Status',
      type: 'checkbox' as const,
      options: statusOptions,
      value: selectedStatuses,
    },
    {
      id: 'tags',
      title: 'Tags',
      type: 'checkbox' as const,
      options: allTags,
      value: selectedTags,
    },
  ];

  const getCategoryColor = (category: string) => {
    const cat = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
    return cat?.color || 'bg-gray-500';
  };

  const handleFilterChange = (sectionId: string, value: string | string[]) => {
    switch (sectionId) {
      case 'status':
        setSelectedStatuses(value as string[]);
        break;
      case 'tags':
        setSelectedTags(value as string[]);
        break;
    }
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedStatuses([]);
    setSelectedTags([]);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    interface ServiceThreadRecord {
      id: number;
      author_id: string | null;
      title: string;
      body: string;
      category: string;
      tags: string[] | null;
      reply_count: number;
      view_count: number;
      answered_reply_id: number | null;
      is_pinned: boolean;
      last_activity_at: string;
      created_at: string;
      author_profile?: { user_id: string; display_name: string | null; team: string | null };
    }
    fetchForumThreadsPage(0, PAGE_SIZE).then((rows: ServiceThreadRecord[]) => {
      if (cancelled) return;
      if (rows.length) {
        setThreads(
          rows.map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            author:
              t.author_profile?.display_name ||
              (t.author_id && user?.id && t.author_id === user.id ? 'You' : 'User'),
            authorTeam: '',
            lastReply: new Date(t.last_activity_at).toLocaleTimeString(),
            lastReplyDate: new Date(t.last_activity_at),
            replies: t.reply_count,
            views: t.view_count,
            isAnswered: !!t.answered_reply_id,
            isPinned: t.is_pinned,
            tags: t.tags || [],
            preview: t.body.slice(0, 120) + (t.body.length > 120 ? '…' : ''),
          }))
        );
      } else {
        setThreads([]);
      }
      setHasMore(rows.length === PAGE_SIZE);
      setPage(0);
      setLoading(false);
      if (user?.id) {
        getSavedItems(user.id, 'forum_thread').then((items) =>
          setSaved(new Set(items.map((i) => i.item_id)))
        );
      }
    });
    const unsub = subscribeToNewThreads((t: ServiceThreadRecord) => {
      setThreads((prev) => {
        if (prev.some((p) => p.id === t.id)) return prev;
        return [
          {
            id: t.id,
            title: t.title,
            category: t.category,
            author:
              t.author_profile?.display_name ||
              (t.author_id && user?.id && t.author_id === user.id ? 'You' : 'User'),
            authorTeam: '',
            lastReply: 'just now',
            lastReplyDate: new Date(t.created_at),
            replies: t.reply_count,
            views: t.view_count,
            isAnswered: !!t.answered_reply_id,
            isPinned: t.is_pinned,
            tags: t.tags || [],
            preview: t.body.slice(0, 120) + (t.body.length > 120 ? '…' : ''),
          },
          ...prev,
        ];
      });
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.id]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    const nextOffset = (page + 1) * PAGE_SIZE;
    fetchForumThreadsPage(nextOffset, PAGE_SIZE).then((rows: ServiceThreadRecord[]) => {
      setThreads((prev) => [
        ...prev,
        ...rows.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          author:
            t.author_profile?.display_name ||
            (t.author_id && user?.id && t.author_id === user.id ? 'You' : 'User'),
          authorTeam: '',
          lastReply: new Date(t.last_activity_at).toLocaleTimeString(),
          lastReplyDate: new Date(t.last_activity_at),
          replies: t.reply_count,
          views: t.view_count,
          isAnswered: !!t.answered_reply_id,
          isPinned: t.is_pinned,
          tags: t.tags || [],
          preview: t.body.slice(0, 120) + (t.body.length > 120 ? '…' : ''),
        })),
      ]);
      setHasMore(rows.length === PAGE_SIZE);
      setPage((p) => p + 1);
    });
  }, [hasMore, page, user?.id]);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      if (el.scrollHeight - (el.scrollTop + window.innerHeight) < 200) {
        loadMore();
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore]);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2>Community Forums</h2>
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowNewThread((v) => !v)}
          >
            <Plus className="mr-1 size-4" />
            {showNewThread ? 'Close' : 'Ask Question'}
          </Button>
        </div>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search discussions, authors, or topics..."
          onSearch={setSearchQuery}
          onFilterToggle={() => setShowFilters(!showFilters)}
          showFilters={true}
          activeFilters={activeFilters}
          onClearFilters={clearFilters}
        />

        {/* Category Filter Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
                selectedCategory === category.id
                  ? 'border-2 border-teal-300 bg-teal-100 text-teal-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Results count and sort */}
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredThreads.length} {filteredThreads.length === 1 ? 'discussion' : 'discussions'}{' '}
            found
          </p>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="px-4">
        <FilterPanel
          sections={filterSections}
          onFilterChange={handleFilterChange}
          onApplyFilters={() => setShowFilters(false)}
          onClearFilters={clearFilters}
          isVisible={showFilters}
        />
      </div>

      {/* Threads List / Creation */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {showNewThread && (
          <Card className="border-teal-200">
            <CardContent className="space-y-5 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="new-thread-title">
                  Title *
                </label>
                <input
                  id="new-thread-title"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="Clear, specific question title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={140}
                  required
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {newTitle.length}/140
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="new-thread-body">
                  Details *
                </label>
                <textarea
                  id="new-thread-body"
                  className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  rows={6}
                  placeholder="Provide context, what you tried, errors, logs, robot behavior, etc."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Include enough info for others to help efficiently.
                </p>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Tags</label>
                {newTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newTags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer hover:bg-red-100 hover:text-red-700"
                        onClick={() => setNewTags(newTags.filter((x) => x !== t))}
                      >
                        {t} <span className="ml-1 text-[10px]">✕</span>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="Add tag and press Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = tagInput.trim().toLowerCase();
                        if (t && !newTags.includes(t)) {
                          setNewTags([...newTags, t]);
                        }
                        setTagInput('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!tagInput.trim()}
                    onClick={() => {
                      const t = tagInput.trim().toLowerCase();
                      if (t && !newTags.includes(t)) {
                        setNewTags([...newTags, t]);
                      }
                      setTagInput('');
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'help',
                    'programming',
                    'mechanical',
                    'electronics',
                    'strategy',
                    'controls',
                    'vision',
                    'cad',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const t = s.toLowerCase();
                        if (!newTags.includes(t)) setNewTags([...newTags, t]);
                      }}
                      className={`rounded border px-2 py-1 text-xs transition-colors ${newTags.includes(s) ? 'border-teal-300 bg-teal-100 text-teal-800' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowNewThread(false);
                    setNewTitle('');
                    setNewBody('');
                    setTagInput('');
                    setNewTags([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={submitting || !newTitle.trim() || !newBody.trim()}
                  onClick={async () => {
                    if (!newTitle.trim() || !newBody.trim()) return;
                    setSubmitting(true);
                    try {
                      const created = await withToast(
                        createForumThread({
                          title: newTitle.trim(),
                          body: newBody.trim(),
                          category: selectedCategory === 'all' ? 'general' : selectedCategory,
                          tags: newTags,
                          author_id: user?.id || null,
                        }),
                        { loading: 'Posting…', success: 'Thread posted', error: 'Post failed' }
                      );
                      if (created) {
                        setThreads((ts) => [
                          {
                            id: created.id,
                            title: created.title,
                            category: created.category,
                            author: user?.id && created.author_id === user.id ? 'You' : 'User',
                            authorTeam: '',
                            lastReply: 'just now',
                            lastReplyDate: new Date(created.created_at),
                            replies: created.reply_count,
                            views: created.view_count,
                            isAnswered: !!created.answered_reply_id,
                            isPinned: created.is_pinned,
                            tags: created.tags || [],
                            preview:
                              created.body.slice(0, 120) + (created.body.length > 120 ? '…' : ''),
                          },
                          ...ts,
                        ]);
                      }
                    } finally {
                      setSubmitting(false);
                      setShowNewThread(false);
                      setNewTitle('');
                      setNewBody('');
                      setNewTags([]);
                      setTagInput('');
                    }
                  }}
                >
                  {submitting ? 'Posting…' : 'Post Question'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {loading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}
        {filteredThreads.length === 0 && !loading ? (
          <div className="py-12 text-center">
            <MessageSquare className="mx-auto mb-4 size-12 text-gray-400" />
            <h3>No discussions found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {searchQuery || activeFilters.length > 0
                ? 'Try adjusting your search or filters'
                : 'Be the first to start a conversation in this category!'}
            </p>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                if (searchQuery || activeFilters.length > 0) {
                  setSearchQuery('');
                  clearFilters();
                } else {
                  setShowNewThread(true);
                }
              }}
            >
              {searchQuery || activeFilters.length > 0
                ? 'Clear Search & Filters'
                : 'Start Discussion'}
            </Button>
          </div>
        ) : (
          filteredThreads.map((thread) => (
            <Card key={thread.id} className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Avatar className="mt-1 size-8">
                    {thread.avatar_url && (
                      <AvatarImage src={thread.avatar_url} alt={thread.author} />
                    )}
                    <AvatarFallback className="bg-teal-100 text-xs text-teal-600">
                      {thread.author
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className={`size-2 rounded-full ${getCategoryColor(thread.category)}`} />
                      <span className="text-xs text-muted-foreground">{thread.category}</span>
                      {thread.isPinned && (
                        <Badge
                          variant="secondary"
                          className="bg-yellow-100 text-xs text-yellow-700"
                        >
                          Pinned
                        </Badge>
                      )}
                      {thread.isAnswered && (
                        <Badge variant="secondary" className="bg-green-100 text-xs text-green-700">
                          Answered
                        </Badge>
                      )}
                      {thread.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {thread.tags && thread.tags.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{thread.tags.length - 2} more
                        </span>
                      )}
                    </div>

                    <h3 className="mb-1 line-clamp-2 font-medium">{thread.title}</h3>
                    <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                      {thread.preview}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center">
                          <User className="mr-1 size-3" />
                          {thread.author}
                        </span>
                        <span className="flex items-center">
                          <MessageSquare className="mr-1 size-3" />
                          {thread.replies}
                        </span>
                        <span>👁 {thread.views}</span>
                        {user?.id && (
                          <button
                            className={`flex items-center transition-colors ${saved.has(thread.id) ? 'text-teal-600' : 'text-gray-400 hover:text-teal-600'}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await toggleSaveItem(user.id!, 'forum_thread', thread.id);
                              setSaved((prev) => {
                                const ns = new Set(prev);
                                if (res.saved) ns.add(thread.id);
                                else ns.delete(thread.id);
                                return ns;
                              });
                            }}
                            title={saved.has(thread.id) ? 'Unsave thread' : 'Save thread'}
                          >
                            <Bookmark className="ml-1 size-3" />
                          </button>
                        )}
                      </div>
                      <span className="flex items-center">
                        <Clock className="mr-1 size-3" />
                        {thread.lastReply}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="mt-2 size-4 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {hasMore && !loading && (
          <div className="flex justify-center py-4">
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}
      </div>
      {/* Modal removed; inline form above */}
    </div>
  );
}
