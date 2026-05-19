# PWA + Offline Kiosk + Web Push

**Status:** Deferred / not yet implemented. This document is the executable spec.
**Owner:** TBD.
**Last updated:** 2026-05-18.

---

## Goal

Three coupled improvements:

1. **PWA install.** Make `21bristoe.com` installable as a home-screen app (Chrome / Safari add-to-home). One-tap into `/drinks/menu`.
2. **Offline kiosk resilience.** Service worker caches `/drinks/kiosk` shell so wifi blips don't black-screen the wall display.
3. **Web Push.** Subscribed browsers receive push notifications for drink milestones and daily briefs, independent of the Home Assistant companion app.

Kiosk reliability is the highest-priority piece — any visible failure on the wall display is bad UX. Push is the multiplier — gives the site phone presence without requiring HA app install.

---

## Implementation outline

### PWA plumbing

Add `@vite-pwa/sveltekit` plugin. Configure in `vite.config.ts`:

```ts
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '21 Bristoe',
        short_name: '21B',
        description: 'Drinks, stats, and the Bristoe household.',
        theme_color: '#<warm-token-value>',
        background_color: '#<warm-token-value>',
        display: 'standalone',
        scope: '/',
        start_url: '/drinks',     // most-used surface
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // See "Service worker strategy" below.
      }
    })
  ]
});
```

Reuse existing favicons from `public/` for icon sources; render new maskable variant via `sharp` (admin already has sharp in the dependency tree).

### Service worker strategy

Use Workbox runtime caching configured via the plugin:

| Pattern                              | Strategy                | Notes                                                  |
|--------------------------------------|-------------------------|--------------------------------------------------------|
| `/drinks/kiosk`, `/drinks/menu` HTML | `StaleWhileRevalidate`  | Survive brief network outages; updates on next fetch.  |
| `/_app/**/*.{js,css,woff2}`          | `CacheFirst` + expiration | Hashed assets; safe to cache aggressively.            |
| `/uploads/**`                        | `CacheFirst` (max 7d)   | Photos rarely change; nginx already sets 7d expires.   |
| `/drinks/api/**`                     | `NetworkOnly`           | Never serve stale order data.                          |
| `/stats/api/**`                      | `NetworkOnly`           | Same — stale metrics worse than no metrics.            |
| `/drinks/api/stream`, `/stats/api/stream` | `NetworkOnly`      | SSE must not be cached.                                |
| All other navigations                | `NetworkFirst` (3s timeout) → fallback to `/+offline` | |

Custom offline page at `src/routes/+offline/+page.svelte` — minimal "reconnecting…" UI styled with theme tokens. Kiosk-specific: include a JS retry loop that refreshes every 10s while offline.

### Web Push

#### VAPID keys (one-time setup)

```bash
npx web-push generate-vapid-keys
```

Output two base64 strings — store in `.env`:

```
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:faberalarcon1@gmail.com
```

Document the keys in `deploy/` notes (NOT committed). Rotating means invalidating all subscriptions.

#### Database

New Drizzle migration `drizzle/0008_push_subscriptions.sql`:

```sql
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_success_at INTEGER,
  failure_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_push_subscriptions_profile ON push_subscriptions(profile_id);
```

`failure_count` drives auto-cleanup: after 3 consecutive 4xx/410 responses from the push service, delete the subscription.

#### Server module

**`src/lib/server/push.ts`** (new):

```ts
export async function sendPush(
  payload: { title: string; body: string; url?: string; tag?: string },
  filter?: { profileId?: number; profileIds?: number[]; broadcast?: boolean }
): Promise<{ sent: number; failed: number; dropped: number }>;
```

Uses `web-push` npm package. Iterates matching subscriptions, posts in parallel with `Promise.allSettled`, increments/resets `failure_count`, deletes after 3 strikes or HTTP 410.

#### Subscription endpoint

**`src/routes/api/push/subscribe/+server.ts`** (new):

- `POST` — accepts `{ subscription: PushSubscriptionJSON, profile_id?: number }`, validates VAPID, inserts row.
- `DELETE` — accepts `{ endpoint: string }`, removes row.
- Rate-limited per IP.

#### Trigger points

Fire push alongside existing HA events, never replacing:

1. **Milestones** (`src/routes/drinks/api/orders/+server.ts:~150`):
   ```ts
   // existing HA fireEvent...
   await sendPush(
     { title: `Milestone: ${milestone.name}`, body: ttsText, url: '/drinks/recent', tag: 'milestone' },
     { broadcast: true }
   );
   ```

2. **Daily brief** (Feature 2, `src/lib/stats/server/brief.ts`):
   ```ts
   await sendPush(
     { title: 'Daily Brief', body: truncate(brief.narrative, 180), url: '/stats/brief', tag: 'daily-brief' },
     { broadcast: true }
   );
   ```

Use `tag` so a new push replaces the old one of the same kind on the lock screen (avoids stack-up).

#### UI

- **Subscribe banner** on `/drinks` profile page and `/stats/brief`: "Get notifications on this device?" → button calls `Notification.requestPermission()` → registers via `pushManager.subscribe({ applicationServerKey })` → POST to `/api/push/subscribe`.
- **Settings toggle** on the profile page to unsubscribe.
- Store opt-in state in `localStorage` to suppress the banner once dismissed.

### Critical files

- `vite.config.ts` (add `SvelteKitPWA` plugin)
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png` (new — generate from existing favicon)
- `src/service-worker.ts` (SvelteKit convention — or rely on auto-generated by `@vite-pwa/sveltekit`)
- `src/routes/+offline/+page.svelte` (new)
- `drizzle/0008_push_subscriptions.sql` (new)
- `src/lib/server/push.ts` (new)
- `src/routes/api/push/subscribe/+server.ts` (new)
- `src/routes/drinks/api/orders/+server.ts` (fire push on milestone)
- `src/lib/stats/server/brief.ts` (fire push on daily brief — depends on Feature 2)
- `src/lib/drinks/components/PushSubscribeBanner.svelte` (new)

---

## Gotchas / caveats

### iOS Safari

- Web Push on iOS requires the user to first **Add to Home Screen**. Subscription will fail silently in regular Safari. Detect via `'standalone' in navigator` (after install) or `window.matchMedia('(display-mode: standalone)').matches`.
- Banner copy on iOS Safari (pre-install): "Add 21 Bristoe to your home screen, then come back here to enable notifications."
- iOS notification format is more conservative — keep `body` under 180 chars; emoji generally renders but some won't.

### Service worker pitfalls

- Avoid `precaching` everything — SvelteKit's hashed asset list changes every deploy and bloats the cache. Only precache the kiosk shell explicitly.
- Service worker scope must be `/` (top-level) to control all routes. Don't nest under `/drinks/`.
- During development, register a "dev mode" SW that skips caching to avoid stale state during `npm run dev`.

### HA `notify` fallback

Push is additive, not a replacement. The existing HA fireEvent flow on milestones must remain unchanged so users without web push (or with disabled notifications) still get the alert through their HA companion app. Spec: every push trigger point calls HA first, then push — failure to push must not affect the HA path.

### Subscription churn

Push endpoints expire (Chrome reissues them, users clear site data, etc.). The auto-cleanup logic (3 failures → delete row) prevents the table from growing unboundedly. Surface counts in `/admin/drinks/settings` so operator can see if everyone's silently unsubscribed.

---

## Acceptance criteria

- ✅ Install on iPhone Chrome / Android Chrome → opens chromeless from home screen.
- ✅ Disable wifi on the kiosk Pi mid-display → `/drinks/kiosk` continues showing the last-known view with a "reconnecting" indicator; SSE auto-reconnects when wifi returns.
- ✅ Trigger a milestone-firing order → subscribed phone gets a push within 2s alongside the existing HA notification.
- ✅ Hard refresh `/drinks/menu` while offline → falls back to `+offline` page, not a browser error screen.
- ✅ `/manifest.webmanifest` returns 200 with `application/manifest+json` content-type (add this check to `deploy/validate.sh`).
- ✅ Lighthouse PWA score > 90.

---

## Suggested execution order

1. PWA manifest + service worker (no push yet) — validate offline kiosk reliability first; that's the highest-value piece.
2. Web Push subscription endpoint + database table.
3. Wire push into milestone fire path (Feature 4 / drinks orders).
4. Wire push into daily brief — depends on Feature 2 shipping.
5. Bake into `deploy/validate.sh`.

Each step gets its own deploy cycle (`npm run dev` → `npm run check && npm run build` → `./deploy/deploy.sh` → `./deploy/validate.sh` → commit + push).

---

## Open questions

- iOS push currently requires APNs-backed endpoints — confirm `web-push` library version handles this transparently or document the additional setup.
- Does the kiosk Pi's Chromium version support service workers reliably? (Older builds had bugs around `caches` API.) Test on actual hardware.
- Push payloads are limited to ~3 KB. Confirm brief truncation never exceeds.
