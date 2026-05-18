import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, type Dispatcher } from 'undici';

export interface UrlValidationResult {
  ok: boolean;
  error?: string;
  /** Parsed URL, only set when ok === true. */
  url?: URL;
  /** IP addresses the hostname resolved to at validation time, only when ok === true. */
  addresses?: string[];
}

/**
 * Build an undici Agent whose connect-time DNS lookup always returns one of
 * the IPs already validated by validateOutboundUrl, so a malicious authoritative
 * DNS server cannot rebind the hostname to a loopback / metadata address between
 * validation and fetch. Pass the returned dispatcher to fetch():
 *
 *   fetch(url, { dispatcher: buildPinnedDispatcher(addresses) })
 */
export function buildPinnedDispatcher(addresses: string[]): Dispatcher {
  if (!addresses.length) {
    throw new Error('buildPinnedDispatcher requires at least one validated address');
  }
  const picked = addresses[0];
  const family = isIP(picked);
  if (family !== 4 && family !== 6) {
    throw new Error(`buildPinnedDispatcher: invalid address ${picked}`);
  }
  return new Agent({
    connect: {
      // The custom lookup ignores the hostname entirely and only ever returns
      // the pre-validated IP — defeating DNS rebinding. Node 22's happy-eyeballs
      // connect calls lookup with { all: true }, expecting the callback to be
      // invoked with an array of { address, family }. Support both shapes.
      lookup: (
        _hostname: string,
        options: { all?: boolean } | undefined,
        cb: (
          err: NodeJS.ErrnoException | null,
          address: string | Array<{ address: string; family: number }>,
          family?: number
        ) => void
      ) => {
        if (options && options.all) {
          (cb as (err: NodeJS.ErrnoException | null, results: Array<{ address: string; family: number }>) => void)(
            null,
            [{ address: picked, family }]
          );
        } else {
          (cb as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(
            null,
            picked,
            family
          );
        }
      }
    }
  });
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    out = (out << 8) | n;
  }
  return out >>> 0;
}

function inRange(ip: number, base: string, maskBits: number): boolean {
  const b = ipv4ToInt(base);
  if (b === null) return false;
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ip & mask) === (b & mask);
}

function isLoopbackOrMetaIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  // 127/8 (loopback), 169.254/16 (link-local / cloud metadata), 0.0.0.0/8
  return inRange(n, '127.0.0.0', 8) || inRange(n, '169.254.0.0', 16) || inRange(n, '0.0.0.0', 8);
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return (
    inRange(n, '10.0.0.0', 8) ||
    inRange(n, '172.16.0.0', 12) ||
    inRange(n, '192.168.0.0', 16) ||
    inRange(n, '100.64.0.0', 10) ||   // CGNAT
    inRange(n, '224.0.0.0', 4) ||     // multicast
    inRange(n, '240.0.0.0', 4)        // reserved / broadcast
  );
}

function isLoopbackIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return lower === '::1' || lower === '::';
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (isLoopbackIpv6(lower)) return true;
  // link-local fe80::/10
  if (/^fe[89ab]/.test(lower)) return true;
  // unique-local fc00::/7
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice(7);
    if (isIP(v4) === 4) return isLoopbackOrMetaIpv4(v4) || isPrivateIpv4(v4);
  }
  return false;
}

/**
 * Validate a user-supplied base URL before using it as a bearer-token target.
 *
 * Always blocks:
 *   - non-http/https schemes
 *   - embedded credentials
 *   - loopback (127/8, ::1) and link-local/metadata (169.254/16)
 *
 * Conditionally blocks private/LAN ranges (RFC1918, ULA, CGNAT). For this
 * project the default is to ALLOW LAN because Home Assistant typically runs on
 * the same network (e.g. ai.local). Set `HA_STRICT_PUBLIC=1` on cloud/public
 * deployments to tighten to public-internet-only.
 */
export async function validateOutboundUrl(raw: string): Promise<UrlValidationResult> {
  if (!raw) return { ok: false, error: 'URL is required.' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'URL is malformed.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'URL must use http or https.' };
  }
  if (url.username || url.password) {
    return { ok: false, error: 'Embedded credentials are not allowed in URL.' };
  }

  const strictPublic = process.env.HA_STRICT_PUBLIC === '1';
  const host = url.hostname;
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      const resolved = await lookup(host, { all: true });
      addresses = resolved.map((r) => r.address);
    } catch (err) {
      return { ok: false, error: `DNS lookup failed for ${host}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (addresses.length === 0) {
    return { ok: false, error: `DNS returned no addresses for ${host}.` };
  }

  for (const addr of addresses) {
    const kind = isIP(addr);
    if (kind !== 4 && kind !== 6) {
      return { ok: false, error: `Host ${host} resolved to unexpected address ${addr}.` };
    }
    const loopback = kind === 4 ? isLoopbackOrMetaIpv4(addr) : isLoopbackIpv6(addr);
    if (loopback) {
      return { ok: false, error: `Host ${host} resolves to a loopback/metadata address (${addr}) — refused.` };
    }
    if (strictPublic) {
      const privateRange = kind === 4 ? isPrivateIpv4(addr) : isPrivateIpv6(addr);
      if (privateRange) {
        return { ok: false, error: `Host ${host} resolves to a private address (${addr}); blocked by HA_STRICT_PUBLIC.` };
      }
    }
  }

  return { ok: true, url, addresses };
}
