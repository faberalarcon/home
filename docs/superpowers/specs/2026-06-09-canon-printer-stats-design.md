# Canon TS6400 on /stats/printer — design

Date: 2026-06-09
Status: approved

## Goal

Show the household Canon TS6400 inkjet (192.168.1.132) on the existing
`/stats/printer` page: status, ink levels, queue. Verified reachable via
unauthenticated IPP on the LAN (`Get-Printer-Attributes` returns model,
state, marker levels).

## Decisions

- Placement: section inside `/stats/printer` (per Faber), under the K2 content.
- Protocol: minimal in-repo IPP client — no new npm dependency.
- Config: `CANON_PRINTER_URL` env (unset → feature hidden). Prod value
  `http://192.168.1.132:631/ipp/print`. DHCP reservation for `.132`
  recommended on the router (manual step).

## Components

### `src/lib/stats/server/canon.ts`
- `CanonInk { name, colors: string[], levelPct, type }`
- `CanonStatus { model, state: 'idle'|'printing'|'stopped'|'offline', stateReasons: string[], queuedJobs, inks: CanonInk[] }`
- `getCanonStatus(): Promise<CanonStatus | null>` — null when env unset;
  `state: 'offline'` (empty inks) on fetch error/timeout (5 s) or parse
  failure. Encodes IPP 1.1 Get-Printer-Attributes (charset, language,
  printer-uri, requested-attributes), POSTs `application/ipp`, walks the
  binary attribute stream (value-tag, name-len, name, value-len, value),
  maps printer-state enum 3/4/5 → idle/printing/stopped. Multi-valued
  attributes (markers, hex color lists like `#00CFFF#F200FF#FFDA00`)
  handled via empty-name continuation values.

### `src/routes/stats/printer/+page.server.ts`
- Add `getCanonStatus()` to the `Promise.all` in `_loadPrinterPageData`;
  return as `canon`. Inherits `withStatsCache`.

### `src/routes/stats/printer/+page.svelte`
- "Office printer" section rendered only when `canon` non-null: model,
  state badge, per-cartridge ink bar (Color cartridge uses a gradient of
  its reported hex colors; Black solid), queue count when > 0, greyed
  offline presentation. Reuse existing card/bar classes from the CFS
  material-box styling.

### Config
- `docker-compose.yml`: `CANON_PRINTER_URL=${CANON_PRINTER_URL:-}`.
- Prod `.env`: set the URL.

## Error handling

Canon fetch never blocks or fails the page: errors collapse to `offline`,
env-off collapses to hidden.

## Verification

`npm run check`, `npm run build`, deploy, then confirm `/stats/printer`
renders live ink (Color 100 %, Black 90 % at time of writing) and that the
section shows offline (not error) when the printer is unplugged.
