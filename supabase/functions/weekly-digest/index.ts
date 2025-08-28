/* eslint-disable */
// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: Weekly Digest
// Sends a summary of new robotics news items and updates to saved threads.
// Env vars required:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - RESEND_API_KEY
// - RESEND_FROM (e.g., "Robotics Hub <noreply@yourdomain>")

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('PROJECT_URL') || '';
const SERVICE_ROLE_KEY =
  Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'Robotics Hub <noreply@example.com>';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY for weekly-digest');
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function htmlEscape(s: string) {
  return s.replace(
    /[&<>\"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  );
}

function renderEmail({
  displayName,
  items,
  threads,
  periodDays,
}: {
  displayName: string;
  items: any[];
  threads: any[];
  periodDays: number;
}) {
  const itemList = items
    .slice(0, 8)
    .map(
      (it) =>
        `<li><strong>${htmlEscape(it.title)}</strong> <span style="color:#6b7280">(${new Date(it.published_at).toLocaleDateString()})</span></li>`
    )
    .join('');
  const threadItems = threads
    .slice(0, 5)
    .map(
      (t) =>
        `<li><strong>${htmlEscape(t.title)}</strong> <span style=\"color:#6b7280\">(${new Date(t.last_activity_at).toLocaleDateString()})</span></li>`
    )
    .join('');

  return `
  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,\n Cantarell,Noto Sans,sans-serif">
    <h2 style="color:#0f766e;margin-bottom:8px">Hi ${htmlEscape(displayName || 'there')}, here’s your Robotics Hub weekly digest</h2>
    <p style="color:#374151;margin-top:0">Highlights from the last ${periodDays} days.</p>

  <h3 style="margin:16px 0 6px">New robotics news</h3>
  ${itemList ? `<ul>${itemList}</ul>` : '<p style="color:#6b7280">No new items in this period.</p>'}

    <h3 style="margin:16px 0 6px">Saved threads with new activity</h3>
    ${threadItems ? `<ul>${threadItems}</ul>` : '<p style="color:#6b7280">No new activity on your saved threads.</p>'}

    <p style="color:#6b7280;font-size:12px;margin-top:24px">Manage preferences in Profile → Account & Privacy. To stop these emails, disable Email Notifications.</p>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getTargets() {
  // Pull users who opted into email and are public (adjust if you want to include private)
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select(
      'user_id, display_name, followed_tags, email_notifications, public_profile, email_frequency, last_digest_at'
    )
    .eq('email_notifications', true);
  if (error || !profiles) return [] as any[];

  // Fetch emails via Admin API (auth.users) to avoid exposing emails publicly
  const results: any[] = [];
  for (const p of profiles) {
    if (p.email_frequency === 'off') continue;
    const userRes = await supabase.auth.admin.getUserById(p.user_id);
    const email = userRes.data.user?.email;
    if (!email) continue;
    results.push({ ...p, email });
  }
  return results;
}

async function getNewsSince(sinceISO: string) {
  // Simple recent-items fetch; optional: join feed_tags to tailor by followed tags
  const { data, error } = await supabase
    .from('feed_items')
    .select('id, title, published_at')
    .gte('published_at', sinceISO)
    .order('published_at', { ascending: false })
    .limit(12);
  if (error) return [] as any[];
  return data || [];
}

async function getSavedThreadUpdates(userId: string, sinceISO: string) {
  const { data: saved } = await supabase
    .from('saved_items')
    .select('item_id')
    .eq('user_id', userId)
    .eq('item_type', 'forum_thread');
  const ids = (saved || []).map((s: { item_id: string }) => s.item_id);
  if (!ids.length) return [] as any[];
  const { data } = await supabase
    .from('forum_threads')
    .select('id, title, last_activity_at')
    .in('id', ids)
    .gte('last_activity_at', sinceISO)
    .order('last_activity_at', { ascending: false })
    .limit(10);
  return data || [];
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    let days = Math.max(1, Math.min(14, Number(url.searchParams.get('days') || 7)));
    let dryRun = url.searchParams.get('dry_run') === 'true';
    let test = url.searchParams.get('test') === 'true' || url.searchParams.get('test') === '1';
    let limitParam = url.searchParams.get('limit');

    // If POST with JSON body, allow providing params there too
    if (req.method !== 'GET') {
      try {
        const body = await req.json();
        if (typeof body?.days === 'number') days = Math.max(1, Math.min(14, body.days));
        if (typeof body?.dry_run === 'boolean') dryRun = body.dry_run;
        if (typeof body?.test === 'boolean') test = body.test;
        if (typeof body?.limit === 'number') limitParam = String(body.limit);
      } catch {
        // ignore parse errors
      }
    }
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    // If test mode: authenticate user and only send to that user
    let targets: any[] = [];
    if (test) {
      const authAware = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      });
      const { data: userData } = await authAware.auth.getUser();
      const authUser = userData?.user;
      if (!authUser) {
        return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select(
          'user_id, display_name, followed_tags, email_notifications, public_profile, email_frequency, last_digest_at'
        )
        .eq('user_id', authUser.id)
        .single();
      if (!profile) {
        return new Response(JSON.stringify({ ok: false, error: 'Profile not found' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 404,
        });
      }
      targets = [{ ...profile, email: authUser.email }];
    } else {
      targets = await getTargets();
    }

    const limitRecipients = Number(limitParam) || targets.length;

    const sent: any[] = [];
    for (const t of targets.slice(0, limitRecipients)) {
      // Skip daily users if days window is weekly (basic respect for frequency)
      if (t.email_frequency === 'daily' && days > 1) continue;
      // Skip weekly users if we recently sent within the window
      if (t.email_frequency === 'weekly' && t.last_digest_at) {
        try {
          const last = new Date(t.last_digest_at);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          if (last > cutoff) continue;
        } catch (_) {
          /* ignore parse issues */
        }
      }
      // Fetch recent news items for the window
      const items = await getNewsSince(since);
      const threads = await getSavedThreadUpdates(t.user_id, since);
      const html = renderEmail({
        displayName: t.display_name || t.email?.split('@')[0] || '',
        items,
        threads,
        periodDays: days,
      });
      if (!dryRun) {
        await sendEmail(t.email, 'Your Robotics Hub Weekly Digest', html);
        // Mark last sent time
        await supabase
          .from('user_profiles')
          .update({ last_digest_at: new Date().toISOString() })
          .eq('user_id', t.user_id);
      }
      sent.push({ to: t.email, items: items.length, threads: threads.length });
    }

    return new Response(JSON.stringify({ ok: true, count: sent.length, sent }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
