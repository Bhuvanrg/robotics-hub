# weekly-digest (Supabase Edge Function)

Sends a weekly email digest to users who enabled Email Notifications, prioritizing posts matching their followed tags and activity on saved threads.

## Environment variables (set in Supabase project)

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY
- RESEND_FROM (e.g., "Robotics Hub <noreply@yourdomain>")

## Deploy

1. Ensure the RESEND credentials are valid and the sender domain is verified.
2. Deploy the function with JWT verification disabled (since it runs via scheduler):
   - Deploy using the Dashboard or CLI with the `--no-verify-jwt` flag.

## Test (dry run)

- Trigger with query params: `?days=7&dry_run=true&limit=3`
- Returns JSON with recipients and counts but does not send emails in dry_run.

Example (replace YOUR_EDGE_URL):

```powershell
curl "YOUR_EDGE_URL/weekly-digest?days=7&dry_run=true&limit=3"
```

## Schedule

- Create a weekly cron (e.g., Mondays at 09:00 UTC): `0 9 * * 1`
- Use the Supabase Dashboard Scheduler or CLI to create the schedule targeting this function.

Manual trigger (real send):

```powershell
curl "YOUR_EDGE_URL/weekly-digest?days=7&dry_run=false"
```

## Notes

- This code runs in Deno on Supabase Edge. The local repo includes minimal type shims (`types.d.ts`) to keep editors quiet; real types come from the runtime.
- RLS is enforced for table reads via Postgres policies; the service role key is used here to aggregate data securely server-side.
