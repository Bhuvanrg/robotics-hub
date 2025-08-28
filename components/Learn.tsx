import React, { useState, useMemo, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  TrendingUp,
  X,
  Plus,
  Video,
  FileText,
  BookOpen,
  ExternalLink,
  Star,
  Tag,
  Code2,
  Wrench,
  Cpu,
  Target,
} from 'lucide-react';
import { fetchLearningResources, createLearningResource } from '@/services/learningResources';
import { toast } from 'sonner';

// Category definitions used for filtering and composer options
const categories = [
  {
    id: 'programming',
    name: 'Programming',
    color: 'bg-blue-500',
    icon: Code2,
    description: 'Code, control, and algorithms',
  },
  {
    id: 'cad',
    name: 'CAD',
    color: 'bg-emerald-500',
    icon: Wrench,
    description: 'Design and fabrication',
  },
  {
    id: 'electronics',
    name: 'Electronics',
    color: 'bg-yellow-500',
    icon: Cpu,
    description: 'Sensors, wiring, power',
  },
  {
    id: 'strategy',
    name: 'Strategy',
    color: 'bg-purple-500',
    icon: Target,
    description: 'Game analysis and planning',
  },
  {
    id: 'general',
    name: 'General',
    color: 'bg-gray-500',
    icon: BookOpen,
    description: 'Other topics',
  },
];

const sortOptions = [
  { id: 'newest', label: 'Newest First' },
  { id: 'popular', label: 'Most Popular' },
  { id: 'rating', label: 'Highest Rated' },
  { id: 'relevant', label: 'Most Relevant' },
];

const difficultyLevels = [
  { id: 'Beginner', label: 'Beginner' },
  { id: 'Intermediate', label: 'Intermediate' },
  { id: 'Advanced', label: 'Advanced' },
];

const contentTypes = [
  { id: 'video', label: 'Videos' },
  { id: 'article', label: 'Articles' },
  { id: 'pdf', label: 'PDFs' },
];

interface ResourceBase {
  id: number;
  title: string;
  type: 'video' | 'article' | 'pdf';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  rating: number;
  views: number;
  tags: string[];
  description: string;
  author: string;
  publishDate: Date;
  duration?: string;
  readTime?: string;
  pages?: string;
  url?: string;
  categoryId?: string; // added for easier referencing when created under 'all'
}

type ResourcesByCategory = Record<string, ResourceBase[]>;

interface LearnProps {
  user?: { user_metadata?: { full_name?: string } } | null;
}
export function Learn(_props: LearnProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest');
  // Live data from DB; start empty and populate from Supabase
  const [resources, setResources] = useState<ResourcesByCategory>({});

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('programming');
  const [newType, setNewType] = useState<'video' | 'article' | 'pdf'>('video');
  const [newDifficulty, setNewDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>(
    'Beginner'
  );
  const [newDurationMeta, setNewDurationMeta] = useState(''); // duration / readTime / pages
  const [newDescription, setNewDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [submitting] = useState(false);

  // Filter states
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minRating, setMinRating] = useState('');

  // Get all resources
  const allResources: ResourceBase[] = useMemo(() => {
    if (selectedCategory === 'all') {
      return Object.entries(resources).flatMap(([key, arr]) =>
        (arr || []).map((r: ResourceBase) => ({ ...r, categoryId: key }))
      );
    }
    return (resources[selectedCategory] || []).map((r: ResourceBase) => ({
      ...r,
      categoryId: selectedCategory,
    }));
  }, [selectedCategory, resources]);

  // Get unique filter options
  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    allResources.forEach((resource: ResourceBase) => {
      resource.tags?.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCounts).map(([tag, count]) => ({ id: tag, label: tag, count }));
  }, [allResources]);

  const difficultyOptions = difficultyLevels.map((level) => ({
    ...level,
    count: allResources.filter((r: ResourceBase) => r.difficulty === level.id).length,
  }));

  const typeOptions = contentTypes.map((type) => ({
    ...type,
    count: allResources.filter((r: ResourceBase) => r.type === type.id).length,
  }));

  // Filter and sort resources
  const filteredResources: ResourceBase[] = useMemo(() => {
    const filtered = allResources.filter((resource: ResourceBase) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = resource.title.toLowerCase().includes(query);
        const matchesDescription = resource.description.toLowerCase().includes(query);
        const matchesAuthor = resource.author.toLowerCase().includes(query);
        const matchesTags = resource.tags?.some((tag: string) => tag.toLowerCase().includes(query));

        if (!matchesTitle && !matchesDescription && !matchesAuthor && !matchesTags) {
          return false;
        }
      }

      // Difficulty filter
      if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(resource.difficulty)) {
        return false;
      }

      // Type filter
      if (selectedTypes.length > 0 && !selectedTypes.includes(resource.type)) {
        return false;
      }

      // Tags filter
      if (selectedTags.length > 0) {
        const hasSelectedTags = selectedTags.some((tag) => resource.tags?.includes(tag));
        if (!hasSelectedTags) return false;
      }

      // Rating filter
      if (minRating && resource.rating < parseFloat(minRating)) {
        return false;
      }

      return true;
    });

    // Sort resources
    switch (sortBy) {
      case 'popular':
        filtered.sort((a: ResourceBase, b: ResourceBase) => b.views - a.views);
        break;
      case 'rating':
        filtered.sort((a: ResourceBase, b: ResourceBase) => b.rating - a.rating);
        break;
      case 'relevant':
        // Simple relevance: higher rated + more views
        filtered.sort(
          (a: ResourceBase, b: ResourceBase) => b.rating * b.views - a.rating * a.views
        );
        break;
      default: // newest
        filtered.sort(
          (a: ResourceBase, b: ResourceBase) => b.publishDate.getTime() - a.publishDate.getTime()
        );
    }

    return filtered;
  }, [
    allResources,
    searchQuery,
    selectedDifficulties,
    selectedTypes,
    selectedTags,
    minRating,
    sortBy,
  ]);

  // Get active filters
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedCategory !== 'all') {
      const category = categories.find((c) => c.id === selectedCategory);
      if (category) filters.push(category.name);
    }
    if (selectedDifficulties.length > 0) filters.push(...selectedDifficulties);
    if (selectedTypes.length > 0) filters.push(...selectedTypes);
    if (selectedTags.length > 0) filters.push(...selectedTags);
    if (minRating) filters.push(`${minRating}+ stars`);
    return filters;
  }, [selectedCategory, selectedDifficulties, selectedTypes, selectedTags, minRating]);

  const filterSections = [
    {
      id: 'difficulty',
      title: 'Difficulty Level',
      type: 'checkbox' as const,
      options: difficultyOptions,
      value: selectedDifficulties,
    },
    {
      id: 'type',
      title: 'Content Type',
      type: 'checkbox' as const,
      options: typeOptions,
      value: selectedTypes,
    },
    {
      id: 'tags',
      title: 'Topics',
      type: 'checkbox' as const,
      options: allTags,
      value: selectedTags,
    },
    {
      id: 'rating',
      title: 'Minimum Rating',
      type: 'select' as const,
      options: [
        { id: '4.0', label: '4+ stars' },
        { id: '4.5', label: '4.5+ stars' },
      ],
      value: minRating,
      placeholder: 'Any rating',
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'video':
        return Video;
      case 'article':
        return FileText;
      case 'pdf':
        return BookOpen;
      default:
        return FileText;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-800';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'Advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleFilterChange = (sectionId: string, value: string | string[]) => {
    switch (sectionId) {
      case 'difficulty':
        setSelectedDifficulties(value as string[]);
        break;
      case 'type':
        setSelectedTypes(value as string[]);
        break;
      case 'tags':
        setSelectedTags(value as string[]);
        break;
      case 'rating':
        setMinRating(value as string);
        break;
    }
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedDifficulties([]);
    setSelectedTypes([]);
    setSelectedTags([]);
    setMinRating('');
  };

  const resetComposer = () => {
    setNewTitle('');
    setNewCategory('programming');
    setNewType('video');
    setNewDifficulty('Beginner');
    setNewDurationMeta('');
    setNewDescription('');
    setTagInput('');
    setNewTags([]);
    setNewUrl('');
  };

  const addTag = (t: string) => {
    const tag = t.trim();
    if (!tag || newTags.includes(tag)) return;
    setNewTags((prev) => [...prev, tag]);
  };

  const removeTag = (t: string) => setNewTags((prev) => prev.filter((x) => x !== t));

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDescription.trim()) return;
    // optimistic local entry
    try {
      const record = await createLearningResource({
        title: newTitle.trim(),
        description: newDescription.trim(),
        type: newType,
        difficulty: newDifficulty,
        tags: newTags,
        category: newCategory,
        publishDate: null,
        url: newUrl || undefined,
        // author_id will be set server-side using current auth user
      });
      if (record) {
        setResources((prev) => {
          const copy = { ...prev };
          const cat = newCategory;
          if (!copy[cat]) copy[cat] = [];
          copy[cat] = [
            {
              id: record.id,
              title: record.title,
              type: record.type as 'video' | 'article' | 'pdf',
              difficulty: newDifficulty,
              rating: record.rating,
              views: record.views,
              tags: record.tags || [],
              description: record.description,
              author: 'You',
              publishDate: record.publishDate ? new Date(record.publishDate) : new Date(),
              categoryId: cat,
            },
            ...copy[cat],
          ];
          return copy;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to create resource: ${msg}`);
      console.error('Failed to create learning resource:', e);
    }
    resetComposer();
    setShowComposer(false);
  };

  // Fetch resources on mount
  useEffect(() => {
    let active = true;
    fetchLearningResources().then((all) => {
      if (!active) return;
      // Group by category
      const grouped: ResourcesByCategory = {};
      all.forEach((r) => {
        const cat = r.category || 'general';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({
          id: r.id,
          title: r.title,
          type: r.type as 'video' | 'article' | 'pdf',
          difficulty: ((): 'Beginner' | 'Intermediate' | 'Advanced' => {
            const d = r.difficulty.toLowerCase();
            if (d.startsWith('beg')) return 'Beginner';
            if (d.startsWith('int')) return 'Intermediate';
            if (d.startsWith('adv')) return 'Advanced';
            return 'Beginner';
          })(),
          rating: r.rating,
          views: r.views,
          tags: r.tags || [],
          description: r.description,
          author: 'Author',
          publishDate: r.publishDate ? new Date(r.publishDate) : new Date(r.created_at),
          duration: r.durationMinutes ? `${r.durationMinutes}min` : undefined,
          readTime: r.readTimeMinutes ? `${r.readTimeMinutes}min` : undefined,
          pages: r.pages ? `${r.pages} pages` : undefined,
          url: r.url || undefined,
          categoryId: cat,
        });
      });
      setResources(grouped);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white p-4">
        <h2 className="mb-4">Learning Resources</h2>

        {/* Search Bar */}
        <SearchBar
          placeholder="Search tutorials, guides, and resources..."
          onSearch={setSearchQuery}
          onFilterToggle={() => setShowFilters(!showFilters)}
          showFilters={true}
          activeFilters={activeFilters}
          onClearFilters={clearFilters}
        />

        {/* Categories */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg border-2 p-3 text-left transition-all ${
              selectedCategory === 'all'
                ? 'border-teal-300 bg-teal-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="mb-1 flex items-center space-x-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gray-500">
                <TrendingUp className="size-4 text-white" />
              </div>
              <span className="text-sm font-medium">All Resources</span>
            </div>
            <p className="text-xs text-muted-foreground">Browse everything</p>
          </button>

          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`rounded-lg border-2 p-3 text-left transition-all ${
                  isSelected
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="mb-1 flex items-center space-x-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-lg ${category.color}`}
                  >
                    <Icon className="size-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">{category.description}</p>
              </button>
            );
          })}
        </div>

        {/* Results / Sort / Add */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {filteredResources.length} {filteredResources.length === 1 ? 'resource' : 'resources'}{' '}
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
          <Button
            size="sm"
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => setShowComposer((v) => !v)}
          >
            {showComposer ? <X className="mr-1 size-4" /> : <Plus className="mr-1 size-4" />}
            {showComposer ? 'Close' : 'Add Resource'}
          </Button>
        </div>

        {showComposer && (
          <div className="mt-4 rounded-md border border-teal-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-medium" htmlFor="lr-title">
                  Title *
                </label>
                <input
                  id="lr-title"
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={newTitle}
                  maxLength={140}
                  placeholder="Descriptive resource title"
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {newTitle.length}/140
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium" htmlFor="lr-category">
                  Category *
                </label>
                <select
                  id="lr-category"
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor="lr-type">
                    Type *
                  </label>
                  <select
                    id="lr-type"
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    value={newType}
                    onChange={(e) => {
                      const v = e.target.value as 'video' | 'article' | 'pdf';
                      setNewType(v);
                      setNewDurationMeta('');
                    }}
                  >
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor="lr-difficulty">
                    Difficulty *
                  </label>
                  <select
                    id="lr-difficulty"
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    value={newDifficulty}
                    onChange={(e) =>
                      setNewDifficulty(e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')
                    }
                  >
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor="lr-meta">
                    {newType === 'video'
                      ? 'Duration (e.g. 45min)'
                      : newType === 'article'
                        ? 'Read Time (e.g. 10min)'
                        : 'Pages (e.g. 12 pages)'}
                  </label>
                  <input
                    id="lr-meta"
                    value={newDurationMeta}
                    onChange={(e) => setNewDurationMeta(e.target.value)}
                    placeholder={newType === 'pdf' ? '24 pages' : '10min'}
                    className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium" htmlFor="lr-url">
                  Reference URL
                </label>
                <input
                  id="lr-url"
                  className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium" htmlFor="lr-desc">
                  Description *
                </label>
                <textarea
                  id="lr-desc"
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Explain what learners will gain"
                  className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium">Tags</label>
                {newTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newTags.map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="cursor-pointer hover:bg-red-100 hover:text-red-700"
                        onClick={() => removeTag(t)}
                      >
                        {t}
                        <span className="ml-1 text-[10px]">✕</span>
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
                        addTag(tagInput);
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
                      addTag(tagInput);
                      setTagInput('');
                    }}
                  >
                    <Tag className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Basics', 'Guide', 'Tutorial', 'Advanced', 'FRC', 'Tips', 'Best Practices'].map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addTag(s)}
                        className={`rounded border px-2 py-1 text-xs transition-colors ${newTags.includes(s) ? 'border-teal-300 bg-teal-100 text-teal-800' : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                      >
                        {s}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={submitting}
                  onClick={() => {
                    resetComposer();
                    setShowComposer(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={submitting || !newTitle.trim() || !newDescription.trim()}
                  onClick={handleCreate}
                >
                  {submitting ? 'Adding…' : 'Add Resource'}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Click a tag to remove it. Resources save to your Supabase database (sign in required
                by RLS).
              </p>
            </div>
          </div>
        )}
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

      {/* Resources List */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {filteredResources.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 size-12 text-gray-400" />
            <h3>No resources found</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {searchQuery || activeFilters.length > 1
                ? 'Try adjusting your search or filters'
                : 'Try selecting a different category or adjusting your search.'}
            </p>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                setSearchQuery('');
                clearFilters();
              }}
            >
              {searchQuery || activeFilters.length > 1
                ? 'Clear Search & Filters'
                : 'View All Resources'}
            </Button>
          </div>
        ) : (
          filteredResources.map((resource) => {
            const ResourceIcon = getIcon(resource.type);
            return (
              <Card key={resource.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="rounded-lg bg-gray-100 p-2">
                      <ResourceIcon className="size-5 text-gray-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="line-clamp-1 font-medium">{resource.title}</h3>
                        <ExternalLink className="size-4 text-gray-400" />
                      </div>
                      <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                        {resource.description}
                      </p>
                      {/* Tags */}
                      {resource.tags && resource.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {resource.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {resource.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{resource.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getDifficultyColor(resource.difficulty)}`}
                          >
                            {resource.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {resource.duration || resource.readTime || resource.pages}
                          </span>
                          <div className="flex items-center space-x-1">
                            <Star className="size-3 text-yellow-500" />
                            <span className="text-xs">{resource.rating}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">👁 {resource.views}</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-teal-600 hover:text-teal-700"
                        >
                          View Resource
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">by {resource.author}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
