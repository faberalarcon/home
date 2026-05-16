import { isIPv4, isIPv6 } from 'node:net';

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function ipv6ToBigInt(ip: string): bigint {
  const [head, tail] = ip.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined ? tail.split(':').filter(Boolean) : [];
  const pad = 8 - headParts.length - tailParts.length;
  const padded = pad > 0 && ip.includes('::') ? Array(pad).fill('0') : [];
  const parts = tail !== undefined
    ? [...headParts, ...padded, ...tailParts]
    : headParts;
  if (parts.length !== 8) return 0n;
  return parts.reduce((acc, hex) => (acc << 16n) + BigInt(parseInt(hex || '0', 16)), 0n);
}

export function isInCidr(ip: string, cidr: string): boolean {
  if (!ip) return false;
  const stripped = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!Number.isFinite(bits)) return false;

  if (isIPv4(stripped) && isIPv4(range)) {
    if (bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipv4ToInt(stripped) & mask) === (ipv4ToInt(range) & mask);
  }

  if (isIPv6(stripped) && isIPv6(range)) {
    if (bits < 0 || bits > 128) return false;
    const i = ipv6ToBigInt(stripped);
    const r = ipv6ToBigInt(range);
    const mask = bits === 0 ? 0n : ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - bits)) - 1n);
    return (i & mask) === (r & mask);
  }

  return false;
}
