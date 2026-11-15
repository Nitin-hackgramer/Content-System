import { BlockList, isIP } from "node:net";

// Addresses a server-side fetch must never reach: loopback, private, link-local (cloud metadata), CGNAT, multicast, reserved.
const blocked = new BlockList();
for (const [net, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3]] as const) blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) blocked.addSubnet(net, bits, "ipv6");

export function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1]; // IPv4 written as IPv6
  if (v4) return isPrivateIp(v4);
  const kind = isIP(ip);
  return kind === 0 || blocked.check(ip, kind === 4 ? "ipv4" : "ipv6");
}
