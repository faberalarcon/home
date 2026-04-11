# Phase 10 — App Abuse Resistance & Authorization Tightening

**Status:** Complete

## Goal

Reduce the chance that an authenticated or semi-authenticated client can spam, scrape, or manipulate the ordering system. This phase focuses on authorization, rate limiting, and route exposure.

## Deliverables

### 1. Replace the current rate limiter with IP + session aware controls

- Keep per-profile throttling if useful for UX.
- Add per-IP and per-authenticated-session limits.
- Apply different thresholds for login, order placement, SSE, and admin login.

Files:
- `src/lib/server/ratelimit.ts`
- `src/routes/api/orders/+server.ts`
- `src/routes/api/stream/+server.ts`
- `src/routes/login/+page.server.ts`
- `src/routes/admin/login/+page.server.ts`

Verify:
- burst ordering from one client gets `429`
- rotating `profileId` alone no longer bypasses limits
- repeated bad logins are throttled

### 2. Lock down order mutation endpoints explicitly

- Require authenticated site session for all order-related APIs.
- Require stronger authorization for destructive or corrective actions:
  - `DELETE /api/orders/[id]`
  - `PUT /api/orders/[id]`
  - `PATCH /api/orders/[id]`
- Decide whether those endpoints should be admin-only.

Files:
- `src/routes/api/orders/+server.ts`
- `src/routes/api/orders/[id]/+server.ts`
- `src/hooks.server.ts`

Verify:
- unauthenticated requests get `401`
- non-admin users cannot delete or reassign if the policy is admin-only

### 3. Limit public data exposure

- Decide whether these routes should remain accessible after login only:
  - `/recent`
  - `/stats`
  - `/kiosk`
  - `/uploads/[...path]`
  - `/api/stream`
- Avoid exposing household names/activity to anonymous visitors.

Files:
- `src/hooks.server.ts`
- affected route files

Verify:
- anonymous requests cannot enumerate recent orders or live events
- intended logged-in users still get the expected pages

### 4. Add request validation and safer error handling

- Validate input types and acceptable ranges for all write endpoints.
- Reject malformed JSON and oversized payloads consistently.
- Keep error responses generic where detailed messages would help attackers.

Files:
- `src/routes/api/orders/+server.ts`
- `src/routes/api/orders/[id]/+server.ts`
- admin action handlers

Verify:
- invalid request bodies produce clean `400` responses
- no stack traces or internal details leak to clients

### 5. Add logout and session hygiene

- Add explicit logout for the shared site session.
- Consider shorter session TTLs or rolling sessions.
- Optionally separate kiosk/tablet session behavior from normal browser sessions.

Files:
- `src/routes/login/+page.server.ts`
- `src/routes/+layout.svelte`
- `src/lib/server/auth.ts`

Verify:
- logout clears the site session
- expired sessions redirect back to login cleanly

## End-to-end verification

1. Try to spam order creation from one browser and confirm rate limits trigger.
2. Try the same from multiple profiles on the same client and confirm limits still hold.
3. Confirm anonymous users cannot access stream/stats/recent data.
4. Confirm an authenticated household user can still place orders normally.

## Risks / decisions

- Decide whether order correction endpoints are household-user features or admin-only features.
- In-memory rate limiting is acceptable for a single-node deployment, but document the limitation if the app ever scales out.
- If kiosk devices should auto-login, define a separate trusted-device flow rather than weakening the main auth rules.
