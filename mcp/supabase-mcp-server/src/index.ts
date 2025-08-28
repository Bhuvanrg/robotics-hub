import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[supabase-mcp-server] Missing SUPABASE_URL or SUPABASE_*KEY env');
}

let supabase: SupabaseClient | null = null;
try {
  if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  }
} catch (e) {
  console.error('[supabase-mcp-server] createClient failed:', e);
}

// Tool schemas
const QueryInput = z.object({
  table: z.string().min(1),
  select: z.string().default('*'),
  match: z.record(z.any()).optional(),
  range: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).optional(),
  order: z.object({ column: z.string(), ascending: z.boolean().default(true) }).optional(),
});

const MutateInput = z.object({
  table: z.string().min(1),
  values: z.union([z.record(z.any()), z.array(z.record(z.any()))]),
  action: z.enum(['insert', 'update', 'upsert', 'delete']),
  match: z.record(z.any()).optional(),
  returning: z.enum(['minimal', 'representation']).default('representation'),
});

const EdgeCallInput = z.object({
  functionName: z.string().min(1),
  method: z.enum(['GET', 'POST']).default('POST'),
  query: z.record(z.string()).optional(),
  body: z.any().optional(),
  headers: z.record(z.string()).optional(),
});

const server = new Server({
  name: 'supabase-mcp-server',
  version: '0.1.0',
  // Declare available tools
  tools: [
    {
      name: 'supabase.query',
      description:
        'Run a SELECT on a Supabase table. Use match for equality filters; range for pagination.',
      inputSchema: QueryInput,
      handler: async (input: z.infer<typeof QueryInput>) => {
        if (!supabase) throw new Error('Supabase not configured');
        let q = supabase.from(input.table).select(input.select);
        if (input.match) q = q.match(input.match as Record<string, any>);
        if (input.order) q = q.order(input.order.column, { ascending: input.order.ascending });
        if (input.range) q = q.range(input.range[0], input.range[1]);
        const { data, error } = await q;
        if (error) throw error;
        return { content: [{ type: 'json', json: data }] };
      },
    },
    {
      name: 'supabase.mutate',
      description: 'Run an INSERT/UPDATE/UPSERT/DELETE on a Supabase table.',
      inputSchema: MutateInput,
      handler: async (input: z.infer<typeof MutateInput>) => {
        if (!supabase) throw new Error('Supabase not configured');
        const table = supabase.from(input.table);
        let res;
        if (input.action === 'insert') res = await table.insert(input.values).select();
        else if (input.action === 'update')
          res = await table
            .update(input.values)
            .match(input.match || {})
            .select();
        else if (input.action === 'upsert') res = await table.upsert(input.values).select();
        else if (input.action === 'delete')
          res = await table
            .delete()
            .match(input.match || {})
            .select();
        else throw new Error('Invalid action');
        const { data, error } = res;
        if (error) throw error;
        return { content: [{ type: 'json', json: data }] };
      },
    },
    {
      name: 'supabase.edge_call',
      description:
        'Call a Supabase Edge Function over HTTP (requires SUPABASE_URL and SUPABASE_*KEY).',
      inputSchema: EdgeCallInput,
      handler: async (input: z.infer<typeof EdgeCallInput>) => {
        if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL or key');
        const url = new URL(`${SUPABASE_URL}/functions/v1/${input.functionName}`);
        if (input.query)
          Object.entries(input.query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
        const res = await fetch(url.toString(), {
          method: input.method,
          headers: {
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(input.headers || {}),
          },
          body: input.method === 'GET' ? undefined : JSON.stringify(input.body || {}),
        });
        const text = await res.text();
        const body = (() => {
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        })();
        if (!res.ok) throw new Error(typeof body === 'string' ? body : JSON.stringify(body));
        return { content: [{ type: 'json', json: body }] };
      },
    },
  ],
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error('[supabase-mcp-server] ready on stdio');
});
