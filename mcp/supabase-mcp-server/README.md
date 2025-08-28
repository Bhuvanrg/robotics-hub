# Supabase MCP Server

A Model Context Protocol (MCP) server exposing Supabase tools to MCP-compatible clients. It provides:

- supabase.query: SELECT with optional match/order/range
- supabase.mutate: INSERT/UPDATE/UPSERT/DELETE
- supabase.edge_call: Call Supabase Edge Functions over HTTP

## Setup

1. Configure env (either a .env file or environment variables):

- SUPABASE_URL (or use VITE_SUPABASE_URL)
- SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_KEY (falls back to anon if not provided)

1. Install and build

```powershell
cd mcp/supabase-mcp-server
npm install
npm run build
```

1. Run

```powershell
npm start
```

The server communicates over stdio for MCP.

## MCP Client wiring

Add to your MCP client configuration, for example:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "./mcp/supabase-mcp-server",
      "env": {
        "SUPABASE_URL": "${env:VITE_SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${env:SUPABASE_SERVICE_ROLE_KEY}"
      }
    }
  }
}
```

## Security

- Use a service role key only in trusted local environments. For production or shared contexts, prefer scoped Postgres policies and, if needed, a proxy service.
- The tools return JSON results and propagate Supabase errors.
