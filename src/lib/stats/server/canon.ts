// Canon office printer (inkjet) status via IPP Get-Printer-Attributes.
// Minimal in-repo IPP 1.1 client — the printer answers unauthenticated on the
// LAN, and we only need one operation, so no dependency is warranted.

import { request } from 'node:http';
import { env } from '$env/dynamic/private';

const CANON_TIMEOUT = 5000;

export interface CanonInk {
  name: string;
  // marker-colors packs multiple hex values into one string for multi-ink
  // cartridges (e.g. "#00CFFF#F200FF#FFDA00" for the tri-color tank).
  colors: string[];
  levelPct: number | null;
  type: string | null;
}

export type CanonState = 'idle' | 'printing' | 'stopped' | 'offline';

export interface CanonStatus {
  model: string;
  state: CanonState;
  stateReasons: string[];
  queuedJobs: number | null;
  inks: CanonInk[];
}

function canonUrl(): string | null {
  return env.CANON_PRINTER_URL?.trim() || null;
}

const REQUESTED_ATTRIBUTES = [
  'printer-make-and-model',
  'printer-state',
  'printer-state-reasons',
  'queued-job-count',
  'marker-names',
  'marker-colors',
  'marker-levels',
  'marker-types'
];

function encodeRequest(printerUri: string): ArrayBuffer {
  const parts: number[] = [];
  const pushU16 = (v: number) => parts.push((v >> 8) & 0xff, v & 0xff);
  const pushStr = (s: string) => {
    const bytes = new TextEncoder().encode(s);
    pushU16(bytes.length);
    parts.push(...bytes);
  };
  const pushAttr = (tag: number, name: string, value: string) => {
    parts.push(tag);
    pushStr(name);
    pushStr(value);
  };

  pushU16(0x0101); // IPP 1.1
  pushU16(0x000b); // Get-Printer-Attributes
  parts.push(0, 0, 0, 1); // request-id
  parts.push(0x01); // operation-attributes-tag
  pushAttr(0x47, 'attributes-charset', 'utf-8');
  pushAttr(0x48, 'attributes-natural-language', 'en');
  pushAttr(0x45, 'printer-uri', printerUri);
  REQUESTED_ATTRIBUTES.forEach((attr, i) =>
    pushAttr(0x44, i === 0 ? 'requested-attributes' : '', attr)
  );
  parts.push(0x03); // end-of-attributes-tag
  return Uint8Array.from(parts).buffer;
}

type IppValue = string | number;

// Walks the IPP attribute stream: delimiter tags switch groups, value tags
// carry [name-length, name, value-length, value]; an empty name continues the
// previous (multi-valued) attribute.
function parseResponse(body: Uint8Array): Map<string, IppValue[]> {
  const attrs = new Map<string, IppValue[]>();
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const decoder = new TextDecoder();
  let i = 8; // skip version, status-code, request-id
  let current = '';
  while (i < body.length) {
    const tag = body[i++];
    if (tag === 0x03) break; // end-of-attributes
    if (tag < 0x10) continue; // delimiter (group) tag
    const nameLen = view.getUint16(i);
    i += 2;
    const name = decoder.decode(body.subarray(i, i + nameLen));
    i += nameLen;
    const valueLen = view.getUint16(i);
    i += 2;
    const raw = body.subarray(i, i + valueLen);
    i += valueLen;
    if (name) current = name;
    if (!current) continue;
    const value: IppValue =
      (tag === 0x21 || tag === 0x23) && valueLen === 4 ? view.getInt32(i - 4) : decoder.decode(raw);
    const list = attrs.get(current);
    if (list) list.push(value);
    else attrs.set(current, [value]);
  }
  return attrs;
}

function mapState(v: IppValue | undefined): CanonState {
  if (v === 4) return 'printing';
  if (v === 5) return 'stopped';
  return 'idle';
}

function splitColors(packed: string): string[] {
  return packed.split('#').filter(Boolean).map((c) => `#${c}`);
}

export async function getCanonStatus(): Promise<CanonStatus | null> {
  const url = canonUrl();
  if (!url) return null;

  const offline: CanonStatus = {
    model: env.CANON_PRINTER_NAME?.trim() || 'Canon printer',
    state: 'offline',
    stateReasons: [],
    queuedJobs: null,
    inks: []
  };

  try {
    const printerUri = url.replace(/^http/, 'ipp');
    // node:http instead of fetch: the Canon sends an unsolicited
    // "HTTP/1.1 100 Continue" before the real response, which undici rejects
    // outright ("bad response"); the http client ignores stray 1xx.
    const body = await new Promise<Uint8Array>((resolve, reject) => {
      const req = request(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/ipp' },
          timeout: CANON_TIMEOUT
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`ipp http ${res.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
          res.on('error', reject);
        }
      );
      req.on('timeout', () => req.destroy(new Error('ipp timeout')));
      req.on('error', reject);
      req.end(Buffer.from(encodeRequest(printerUri)));
    });
    const attrs = parseResponse(body);

    const names = (attrs.get('marker-names') ?? []).map(String);
    const colors = (attrs.get('marker-colors') ?? []).map(String);
    const levels = attrs.get('marker-levels') ?? [];
    const types = (attrs.get('marker-types') ?? []).map(String);
    const inks: CanonInk[] = names.map((name, idx) => ({
      name,
      colors: splitColors(colors[idx] ?? ''),
      levelPct: typeof levels[idx] === 'number' && (levels[idx] as number) >= 0 ? (levels[idx] as number) : null,
      type: types[idx] ?? null
    }));

    const queued = attrs.get('queued-job-count')?.[0];
    return {
      model: env.CANON_PRINTER_NAME?.trim() || String(attrs.get('printer-make-and-model')?.[0] ?? 'Canon printer'),
      state: mapState(attrs.get('printer-state')?.[0]),
      stateReasons: (attrs.get('printer-state-reasons') ?? []).map(String).filter((r) => r !== 'none'),
      queuedJobs: typeof queued === 'number' ? queued : null,
      inks
    };
  } catch {
    return offline;
  }
}
