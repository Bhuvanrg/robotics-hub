/* eslint-disable @typescript-eslint/no-explicit-any */
// Local type shims for Deno/Supabase Edge Function to satisfy IDE/TS in non-Deno projects.
// These are minimal and safe; the real runtime types come from Deno during deployment.

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any;
}

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};
