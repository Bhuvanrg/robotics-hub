// Quick Supabase configuration check (no secrets printed)
// - Loads .env.local (Vite-style)
// - Creates anon client
// - Reads from public tables with public SELECT policies

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

// keep minimal helpers only; avoid unused vars to appease linters

async function loadEnvLocal() {
  try {
    const raw = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    const env = {};
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      const m = s.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let [, k, v] = m;
      v = v.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      env[k] = v;
    }
    return env;
  } catch (e) {
    return {};
  }
}

async function main() {
  const env = await loadEnvLocal();
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  console.log('Env check:');
  console.log('  VITE_SUPABASE_URL:', url ? 'present' : 'missing');
  console.log('  VITE_SUPABASE_ANON_KEY:', key ? 'present' : 'missing');
  if (!url || !key) {
    console.log('Result: FAIL — missing env vars. Fill .env.local from .env.local.example');
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const results = { ok: true, checks: [] };

  async function check(name, fn) {
    try {
      await fn();
      results.checks.push({ name, ok: true });
    } catch (e) {
      results.ok = false;
      results.checks.push({ name, ok: false, error: String(e?.message || e) });
    }
  }

  await check('select sources', async () => {
    const { error } = await supabase.from('sources').select('id').limit(1);
    if (error) throw error;
  });

  await check('select feed_items', async () => {
    const { error } = await supabase.from('feed_items').select('id').limit(1);
    if (error) throw error;
  });

  await check('select user_profiles', async () => {
    const { error } = await supabase.from('user_profiles').select('user_id').limit(1);
    if (error) throw error;
  });

  await check('select forum_threads', async () => {
    const { error } = await supabase.from('forum_threads').select('id').limit(1);
    if (error) throw error;
  });

  await check('storage public avatar url (synthetic)', async () => {
    // Does not call network; verifies SDK can form a public URL
    const { data } = supabase.storage.from('avatars').getPublicUrl('placeholder.png');
    if (!data?.publicUrl) throw new Error('failed to form public URL');
  });

  await check('storage avatars list (public read policy)', async () => {
    const { error } = await supabase.storage.from('avatars').list('');
    if (error) throw error;
  });

  console.log('\nConnectivity:');
  for (const c of results.checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'} — ${c.name}${c.ok ? '' : ' — ' + c.error}`);
  }
  console.log(`\nOverall: ${results.ok ? 'PASS' : 'FAIL'}`);
  process.exit(results.ok ? 0 : 1);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
