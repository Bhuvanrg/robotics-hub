import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
// removed program tabs for a smarter default feed
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  getFeed,
  getSources,
  postFeedback,
  type FeedItem,
  type ItemType,
  type SourceRow,
} from '@/services/news';
import { useUserPreferences } from './UserPreferencesContext';

const TYPES: Array<{ id: ItemType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'news', label: 'News' },
  { id: 'tutorial', label: 'Tutorials' },
  { id: 'highlight', label: 'Highlights' },
  { id: 'event', label: 'Events' },
  { id: 'research', label: 'Research' },
];

interface NewsFeedProps {
  user?: User;
}

export function NewsFeed({ user: _user }: NewsFeedProps) {
  const { preferences } = useUserPreferences();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [type, setType] = useState<ItemType | 'all'>('all');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [sourceId, setSourceId] = useState<string>('all');
  const endRef = useRef<HTMLDivElement | null>(null);

  const interestWords = useMemo(
    () => (preferences.interests || []).map((w) => w.toLowerCase().trim()).filter(Boolean),
    [preferences.interests]
  );

  // Derive explicit program selections from interests; only filter if user specified any.
  const { selectedPrograms, programsForQuery } = useMemo(() => {
    const picks = new Set<'fll' | 'ftc' | 'frc'>();
    for (const w of interestWords) {
      if (/(^|\b)ftc(\b|$)/i.test(w)) picks.add('ftc');
      if (/(^|\b)frc(\b|$)/i.test(w)) picks.add('frc');
      if (/(^|\b)fll(\b|$)/i.test(w)) picks.add('fll');
    }
    const arr = Array.from(picks);
    const programs =
      arr.length > 0
        ? ([...arr, 'general'] as Array<'fll' | 'ftc' | 'frc' | 'general'>)
        : undefined;
    return { selectedPrograms: arr, programsForQuery: programs };
  }, [interestWords]);

  const scoreItem = useCallback(
    (it: FeedItem): number => {
      let s = Number(it.score || 0);
      const hours = Math.max(
        0,
        (Date.now() - new Date(it.published_at).getTime()) / (1000 * 60 * 60)
      );
      const recency = Math.max(0, 72 - hours) / 72; // 0..1
      s += recency;
      if (interestWords.length) {
        const hay =
          `${it.title} ${it.excerpt || ''} ${it.author || ''} ${it.source?.name || ''}`.toLowerCase();
        let hits = 0;
        for (const w of interestWords) {
          if (!w) continue;
          if (hay.includes(w)) hits += 1;
        }
        s += hits * 2; // each hit +2
      }
      return s;
    },
    [interestWords]
  );

  const mergeAndSort = useCallback(
    (prev: FeedItem[], next: FeedItem[]) => {
      const byId = new Map<string, FeedItem>();
      for (const p of prev) byId.set(p.id, p);
      for (const n of next) byId.set(n.id, n);
      const merged = Array.from(byId.values());
      merged.sort((a, b) => scoreItem(b) - scoreItem(a));
      return merged;
    },
    [scoreItem]
  );

  const interestKey = useMemo(() => interestWords.join('|'), [interestWords]);

  useEffect(() => {
    let cancel = false;
    getSources().then((rows) => {
      if (!cancel) setSources(rows);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFeed({
      type: type === 'all' ? undefined : (type as ItemType),
      sourceId: sourceId !== 'all' ? Number(sourceId) : undefined,
      programs: programsForQuery,
    })
      .then(({ items: rows, nextCursor }) => {
        if (!cancelled) {
          const filtered = selectedPrograms.length
            ? rows.filter((r) => {
                const itemProg = (r.program || 'general') as 'fll' | 'ftc' | 'frc' | 'general';
                return itemProg === 'general' || selectedPrograms.includes(itemProg);
              })
            : rows;
          const finalItems = selectedPrograms.length && filtered.length === 0 ? rows : filtered;
          setItems(mergeAndSort([], finalItems));
          setCursor(nextCursor);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type, sourceId, interestKey, mergeAndSort, selectedPrograms, programsForQuery]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    const { items: rows, nextCursor } = await getFeed({
      type: type === 'all' ? undefined : (type as ItemType),
      sourceId: sourceId !== 'all' ? Number(sourceId) : undefined,
      programs: programsForQuery,
      cursor,
    });
    const filtered = selectedPrograms.length
      ? rows.filter((r) => {
          const itemProg = (r.program || 'general') as 'fll' | 'ftc' | 'frc' | 'general';
          return itemProg === 'general' || selectedPrograms.includes(itemProg);
        })
      : rows;
    const finalItems = selectedPrograms.length && filtered.length === 0 ? rows : filtered;
    setItems((prev) => mergeAndSort(prev, finalItems));
    setCursor(nextCursor);
    setLoading(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">For you</div>
          <div className="flex items-center gap-2">
            {TYPES.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={type === t.id ? 'default' : 'outline'}
                onClick={() => setType(t.id)}
                className="text-xs"
              >
                {t.label}
              </Button>
            ))}
            <div className="w-48">
              <Select value={sourceId} onValueChange={(v) => setSourceId(v)}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Filter by source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Card key={it.id} className="overflow-hidden">
            <CardHeader className="space-y-1 p-3">
              <div className="flex items-center justify-between">
                <div className="truncate text-sm font-semibold">{it.title}</div>
                <Badge variant="secondary" className="text-[10px]">
                  {it.source?.name || 'Source'}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(it.published_at).toLocaleString()}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {it.media_url && (
                <img src={it.media_url} alt="thumb" className="h-40 w-full rounded object-cover" />
              )}
              {it.excerpt && (
                <p className="line-clamp-3 text-sm text-muted-foreground">{it.excerpt}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {it.program.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {it.type}
                  </Badge>
                  {it.region && (
                    <Badge variant="outline" className="text-[10px]">
                      {it.region}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => window.open(it.url, '_blank')}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => postFeedback(it.id, 'save')}
                    title="Save"
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => postFeedback(it.id, 'like')}
                    title="Like"
                  >
                    Like
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div ref={endRef} className="p-3">
        <Button onClick={loadMore} disabled={!cursor || loading} className="w-full">
          {loading ? 'Loading…' : cursor ? 'Load more' : 'No more items'}
        </Button>
      </div>
    </div>
  );
}

export default NewsFeed;
