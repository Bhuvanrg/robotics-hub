/* eslint-disable */
// Supabase Edge Function: News Ingest
// Purpose: Poll configured sources (RSS/YouTube) and upsert into public.feed_items.
// Env:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - YOUTUBE_API_KEY (optional for YouTube)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore: URL import for Deno Edge Function; types resolved at runtime
import { XMLParser } from 'https://esm.sh/fast-xml-parser@4.4.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
const SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY') || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY for news-ingest');
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type Source = {
  id: number;
  type: 'rss' | 'youtube';
  url?: string | null;
  channel_handle?: string | null;
  channel_id?: string | null;
  enabled: boolean;
};

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

// Very lightweight XML→object helper for RSS/Atom (limited); avoids external type deps
function xmlToObj(xml: string): any {
  // Extremely naive conversions for the two shapes we expect (RSS 2.0 and Atom).
  // This is not a general XML parser; for production, prefer a robust RSS parser.
  const getTag = (s: string, tag: string) => {
    const re = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i');
    const m = s.match(re);
    return m ? m[1] : '';
  };
  const getAll = (s: string, tag: string) => {
    const re = new RegExp(`<${tag}[^>]*>[\s\S]*?<\/${tag}>`, 'gi');
    return s.match(re) || [];
  };
  const has = (s: string, tag: string) => new RegExp(`<${tag}[^>]*>`, 'i').test(s);
  const text = (s: string) => s.replace(/<[^>]+>/g, '').trim();
  const attr = (s: string, name: string) => {
    const m = s.match(new RegExp(`${name}="([^"]+)"`, 'i'));
    return m ? m[1] : '';
  };

  // RSS 2.0
  if (has(xml, 'rss') && has(xml, 'channel')) {
    const channel = getTag(xml, 'channel');
    const items = getAll(channel, 'item').map((it) => ({
      title: text(getTag(it, 'title')),
      link: text(getTag(it, 'link')),
      guid: text(getTag(it, 'guid')) || text(getTag(it, 'link')),
      pubDate:
        text(getTag(it, 'pubDate')) || text(getTag(it, 'published')) || text(getTag(it, 'updated')),
      author: text(getTag(it, 'dc:creator')) || text(getTag(it, 'author')),
      description: getTag(it, 'description'),
      content: getTag(it, 'content:encoded'),
      enclosure: attr(getTag(it, 'enclosure'), 'url') || attr(getTag(it, 'media:content'), 'url'),
      mediaThumb: attr(getTag(it, 'media:thumbnail'), 'url'),
    }));
    return { rss: { channel: { item: items } } } as any;
  }
  // Atom
  if (has(xml, 'feed')) {
    const feed = getTag(xml, 'feed');
    const entries = getAll(feed, 'entry').map((e) => ({
      title: text(getTag(e, 'title')),
      link: attr(getTag(e, 'link'), 'href'),
      id: text(getTag(e, 'id')),
      published: text(getTag(e, 'published')) || text(getTag(e, 'updated')),
      author: text(getTag(e, 'name')),
      summary: getTag(e, 'summary'),
      content: getTag(e, 'content'),
    }));
    return { feed: { entry: entries } } as any;
  }
  return {} as any;
}

async function fetchRss(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RoboticsHubBot/1.0 (+https://roboticshub.example)' },
  });
  if (!res.ok) throw new Error(`RSS fetch failed ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    preserveOrder: false,
    trimValues: true,
  });
  const data: any = parser.parse(xml);

  function s(v: any): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object' && '#text' in v) return String(v['#text']);
    try {
      return String(v);
    } catch {
      return '';
    }
  }

  // RSS 2.0
  if (data?.rss?.channel) {
    const ch = data.rss.channel;
    const items = Array.isArray(ch.item) ? ch.item : ch.item ? [ch.item] : [];
    return items.map((it: any) => {
      const title = s(it.title);
      const link = s(it.link);
      const guid = s(typeof it.guid === 'object' ? it.guid?.['#text'] : it.guid) || link;
      const pubDate = s(it.pubDate || it.published || it.updated);
      const author = s(it['dc:creator'] || it.author);
      const description = s(it.description);
      const content = s(it['content:encoded']);
      const enclosure = s(it.enclosure?.['@_url'] || it['media:content']?.['@_url']);
      const mediaThumb = s(it['media:thumbnail']?.['@_url']);
      return { title, link, guid, pubDate, author, description, content, enclosure, mediaThumb };
    });
  }

  // Atom 1.0
  if (data?.feed) {
    const feed = data.feed;
    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
    return entries.map((e: any) => {
      const title = s(e.title);
      const links = Array.isArray(e.link) ? e.link : e.link ? [e.link] : [];
      const alt = links.find((l: any) => l?.['@_rel'] === 'alternate') || links[0] || {};
      const link = s(alt?.['@_href']);
      const guid = s(e.id) || link;
      const pubDate = s(e.published || e.updated);
      const author = s(e.author?.name || (Array.isArray(e.author) ? e.author[0]?.name : ''));
      const description = s(e.summary);
      const content = s(e.content);
      return { title, link, guid, pubDate, author, description, content, enclosure: '', mediaThumb: '' };
    });
  }

  return [] as any[];
}

async function ingestRssSource(source: Source) {
  if (!source.url) return { sourceId: source.id, items: 0 };
  const rawItems = await fetchRss(source.url);
  const rows = await Promise.all(
    rawItems.map(async (r: any) => {
      const external_id = r.guid || r.link || crypto.randomUUID();
      const hash = await sha256Hex(`${source.id}:${external_id}`);
      let media_url = r.enclosure || r.mediaThumb || '';
      const published_at = r.pubDate ? new Date(r.pubDate).toISOString() : new Date().toISOString();
      const excerpt = (r.description || '').replace(/<[^>]+>/g, '').slice(0, 400);
      return {
        source_id: source.id,
        external_id,
        title: r.title || '(untitled)',
        url: r.link || source.url!,
        published_at,
        author: r.author || null,
        excerpt,
        content_html: r.content || null,
        media_url: media_url || null,
        program: 'general',
        type: 'news',
        level: 'general',
        region: null,
        score: 0,
        hash,
      };
    })
  );
  if (!rows.length) return { sourceId: source.id, items: 0 };
  // Upsert on external_id unique
  const { error } = await supabase
    .from('feed_items')
    .upsert(rows as any, { onConflict: 'external_id' });
  if (error) throw error;
  return { sourceId: source.id, items: rows.length };
}

async function ingestYoutubeSource(source: Source) {
  if (!YOUTUBE_API_KEY) return { sourceId: source.id, items: 0, skipped: 'no_api_key' } as any;
  // Resolve channel_id from channel_handle if needed
  if (!source.channel_id && source.channel_handle) {
    try {
      const resolved = await resolveChannelIdFromHandle(source.channel_handle);
      if (resolved) {
        source.channel_id = resolved;
        // Persist resolution for future runs
        await supabase.from('sources').update({ channel_id: resolved }).eq('id', source.id);
      }
    } catch (_) {
      // ignore resolution failures
    }
  }
  // Require channel_id after attempting resolution
  if (!source.channel_id) return { sourceId: source.id, items: 0, skipped: 'no_channel_id' } as any;
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
  searchUrl.searchParams.set('channelId', source.channel_id);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('order', 'date');
  searchUrl.searchParams.set('maxResults', '10');
  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error(`YouTube fetch failed ${res.status}`);
  const data = await res.json();
  const items = (data.items || []).filter((it: any) => it.id?.videoId);
  const rows = await Promise.all(
    items.map(async (it: any) => {
      const vid = it.id.videoId;
      const sn = it.snippet || {};
      const external_id = `yt:${vid}`;
      const hash = await sha256Hex(`${source.id}:${external_id}`);
      return {
        source_id: source.id,
        external_id,
        title: sn.title || '(untitled)',
        url: `https://www.youtube.com/watch?v=${vid}`,
        published_at: new Date(sn.publishedAt || Date.now()).toISOString(),
        author: sn.channelTitle || null,
        excerpt: sn.description?.slice(0, 400) || null,
        content_html: null,
        media_url: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || null,
        program: 'general',
        type: 'highlight',
        level: 'general',
        region: null,
        score: 0,
        hash,
      };
    })
  );
  if (!rows.length) return { sourceId: source.id, items: 0 };
  const { error } = await supabase
    .from('feed_items')
    .upsert(rows as any, { onConflict: 'external_id' });
  if (error) throw error;
  return { sourceId: source.id, items: rows.length };
}

async function resolveChannelIdFromHandle(handle: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null;
  // Use YouTube Search API to find the channel by handle string
  // Handles usually look like "FIRSTTechChallenge" or may be prefixed with '@' in UI; strip '@'
  const q = handle.replace(/^@/, '');
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', YOUTUBE_API_KEY);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'channel');
  url.searchParams.set('q', q);
  url.searchParams.set('maxResults', '1');
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const id = data?.items?.[0]?.id?.channelId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

async function ingestAll() {
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, type, url, channel_handle, channel_id, enabled')
    .eq('enabled', true);
  if (error) throw error;
  const results: any[] = [];
  for (const s of (sources || []) as Source[]) {
    try {
      if (s.type === 'rss') results.push(await ingestRssSource(s));
      else if (s.type === 'youtube') results.push(await ingestYoutubeSource(s));
    } catch (e) {
      results.push({ sourceId: s.id, error: String(e) });
    }
  }
  return results;
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    if (method === 'POST' || method === 'GET') {
      // Optional: request body may specify a single source to ingest
      let payload: any = {};
      if (method === 'POST') {
        try {
          payload = await req.json();
        } catch (_) {
          payload = {};
        }
      }
      if (payload?.source_id) {
        const { data: s } = await supabase
          .from('sources')
          .select('id, type, url, channel_handle, channel_id, enabled')
          .eq('id', payload.source_id)
          .single();
        if (!s)
          return new Response(JSON.stringify({ ok: false, error: 'source_not_found' }), {
            status: 404,
          });
        const src = s as Source;
        const result =
          src.type === 'rss' ? await ingestRssSource(src) : await ingestYoutubeSource(src);
        return new Response(JSON.stringify({ ok: true, result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const results = await ingestAll();
      return new Response(JSON.stringify({ ok: true, results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
