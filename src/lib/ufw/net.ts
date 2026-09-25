export function isV6(addr: string): boolean {
  return addr.includes(":");
}

export function parseIPv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** Validates "any", an IPv4 address/CIDR or (loosely) an IPv6 address/CIDR. */
export function isValidAddr(a: string): boolean {
  if (a === "any") return true;
  const [ip, mask] = a.split("/");
  if (isV6(ip)) {
    if (!/^[0-9a-fA-F:]+$/.test(ip)) return false;
    return mask === undefined || (/^\d+$/.test(mask) && Number(mask) <= 128);
  }
  if (parseIPv4(ip) === null) return false;
  return mask === undefined || (/^\d+$/.test(mask) && Number(mask) <= 32);
}

/** Does `addr` fall inside `cidr`? ("any" matches everything of the same family.) */
export function addrMatches(cidr: string, addr: string): boolean {
  if (cidr === "any") return true;
  if (isV6(cidr) || isV6(addr)) {
    return isV6(cidr) && isV6(addr) && cidr.split("/")[0].toLowerCase() === addr.toLowerCase();
  }
  const [net, maskStr] = cidr.split("/");
  const mask = maskStr === undefined ? 32 : Number(maskStr);
  const a = parseIPv4(addr);
  const n = parseIPv4(net);
  if (a === null || n === null) return false;
  if (mask === 0) return true;
  const m = (0xffffffff << (32 - mask)) >>> 0;
  return (a & m) === (n & m);
}

/** "22" | "8000:8100" | "80,443" */
export function isValidPortSpec(p: string): boolean {
  return p.split(",").every((part) => {
    const range = part.split(":");
    if (range.length > 2) return false;
    return range.every((x) => /^\d+$/.test(x) && Number(x) >= 1 && Number(x) <= 65535);
  });
}

export function portMatches(spec: string, port: number): boolean {
  return spec.split(",").some((part) => {
    const [lo, hi] = part.split(":").map(Number);
    return hi === undefined ? port === lo : port >= lo && port <= hi;
  });
}
