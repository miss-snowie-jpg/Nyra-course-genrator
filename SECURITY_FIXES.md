Summary of security and UX fixes

What I changed ✅

- Video previews and opening:
  - Sanitized oEmbed content in `src/components/AdLibrary/VideoPlayer.tsx` (DOMPurify fallback and script stripping).
  - Added a thumbnail fallback and an explicit “Open source” link if preview/embed is unavailable.
  - Improved polling logic when preview processing is queued.

- Preview/download server changes:
  - `supabase/functions/download-ad/index.ts` now:
    - Respects an optional `ALLOWED_ORIGIN` env var for tighter CORS in production.
    - Requires an `Authorization: Bearer <token>` for downloads (mode !== 'preview') and verifies the token with Supabase Auth.
    - Ensures the authenticated user owns the ad (if the ad has a `user_id`) before allowing a download.

- Ad job management hardening:
  - `supabase/functions/manage-ad-job/index.ts` now requires an Authorization header and validates the token via Supabase Auth (`/auth/v1/user`).
  - Only the ad owner can create/stop jobs for their ad (if the ad has a `user_id`).

- XSS / unsanitized HTML:
  - Removed unsafe CSS injection in `src/components/ui/chart.tsx` and replaced it with a safe generator that validates color tokens. This prevents CSS injection.
  - Sanitized oEmbed HTML (VideoPlayer) with DOMPurify where available; also strips <script> tags as a fallback.

- Password security (low-effort hardening):
  - Client-side minimum password length (≥ 8) enforced in `src/pages/Auth.tsx` to reduce very weak passwords.
  - The project already uses Supabase Auth for credential handling (no plaintext password storage found).

- Misc security UI hardening:
  - `src/pages/AdVideos.tsx` edge function tester now only allows same-origin URLs to avoid SSRF or inadvertent calls to external hosts.

- Dependency:
  - Added `dompurify` to `package.json` (used dynamically in the client to sanitize oEmbed HTML).

Manual verification steps 🔧

1) Install dependencies
   - npm install (or pnpm/yarn) to pick up `dompurify`.

2) Local smoke tests
   - Start the app (npm run dev).
   - Navigate to the page that displays ads (e.g., `/ads` or the Ad library page).
   - Open a variety of ads that are:
      - Direct media (mp4/webm): should play inline.
      - Remote non-media sources (Instagram, YouTube links): should show a sanitized embed or thumbnail, and if unavailable, an "Open source" link should be shown.
   - Try to download a non-preview asset without Authorization: download should return 401.
   - As the ad owner (authenticated), attempt download: should succeed if policy (≤10s) allows it.
   - Call `supabase/functions/manage-ad-job` endpoint without Authorization: should return 401.
   - Call it with a valid JWT for a non-owner: should return 403.

3) Security checks
   - Verify `dangerouslySetInnerHTML` usages are sanitized (VideoPlayer uses DOMPurify dynamically; ChartStyle no longer uses dangerouslySetInnerHTML).
   - Ensure no client-side code includes secret keys (PAYPAL_CLIENT_SECRET, SUPABASE service role, etc.). Server functions still read secrets from env.

Deployment notes 🚀

- Supabase Edge Functions changed: re-deploy `download-ad` and `manage-ad-job` functions so changes propagate to production.
- Set `ALLOWED_ORIGIN` env var in production if you want to restrict CORS (recommended).

If you'd like, I can:
- Add automated integration tests (if you want a test framework added).
- Deploy/redeploy the Supabase functions (if you provide deployment credentials or allow me to run deploy scripts).

If you want immediate follow-up, tell me which part to prioritize next (tests, CI, or deploy).