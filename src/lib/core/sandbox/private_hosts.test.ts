import { describe, expect, it } from "vitest";
import { isPrivateHost } from "./private_hosts.ts";

function readHostname(url: string): string {
  const hostname = new URL(url).hostname;
  return hostname;
}

/** The URLs whose host `isPrivateHost` counts as on the user's computer or network. */
function listPrivateUrls(urls: string[]): string[] {
  const privateUrls: string[] = [];
  for (const url of urls) {
    if (isPrivateHost(readHostname(url))) {
      privateUrls.push(url);
    }
  }
  return privateUrls;
}

describe("isPrivateHost", function describeIsPrivateHost(): void {
  it("Names", function detectsPrivateNames(): void {
    const urls = [
      "http://localhost/a.png",
      "http://printer.localhost/a.png",
      "http://router/a.png",
      "http://nas.local./a.png",
      "http://db.internal/a.png",
      "http://pc.lan/a.png",
      "http://hub.home.arpa/a.png",
    ];

    expect(listPrivateUrls(urls)).toEqual(urls);
  });

  it("Addresses", function detectsPrivateAddresses(): void {
    const urls = [
      "http://0.0.0.0/a.png",
      "http://127.0.0.1/a.png",
      "http://10.1.2.3/a.png",
      "http://172.31.0.1/a.png",
      "http://192.168.0.1/a.png",
      "http://169.254.169.254/a.png",
      "http://100.64.0.1/a.png",
    ];

    expect(listPrivateUrls(urls)).toEqual(urls);
  });

  it("Other forms of an address", function detectsOtherAddressForms(): void {
    expect(isPrivateHost(readHostname("http://2130706433/a.png"))).toBe(true);
    expect(isPrivateHost(readHostname("http://0x7f.1/a.png"))).toBe(true);
    expect(isPrivateHost(readHostname("http://0177.0.0.1/a.png"))).toBe(true);
  });

  it("Public hosts", function acceptsPublicHosts(): void {
    const urls = [
      "http://172.32.0.1/a.png",
      "http://8.8.8.8/a.png",
      "https://localhost.example.net/a.png",
    ];

    expect(listPrivateUrls(urls)).toEqual([]);
  });

  it("drops one trailing dot", function dropsTrailingDot(): void {
    expect(isPrivateHost("localhost.")).toBe(true);
    expect(isPrivateHost("media.example.net.")).toBe(false);
  });

  it("checks the edges of 172.16.0.0/12", function checksPrivateRangeEdges(): void {
    expect(isPrivateHost("172.15.255.255")).toBe(false);
    expect(isPrivateHost("172.16.0.0")).toBe(true);
    expect(isPrivateHost("172.31.255.255")).toBe(true);
    expect(isPrivateHost("172.32.0.0")).toBe(false);
  });

  it("checks the edges of 100.64.0.0/10", function checksSharedRangeEdges(): void {
    expect(isPrivateHost("100.63.255.255")).toBe(false);
    expect(isPrivateHost("100.64.0.0")).toBe(true);
    expect(isPrivateHost("100.127.255.255")).toBe(true);
    expect(isPrivateHost("100.128.0.0")).toBe(false);
  });

  it("checks the other ranges at their edges", function checksOtherRangeEdges(): void {
    expect(isPrivateHost("0.255.255.255")).toBe(true);
    expect(isPrivateHost("1.0.0.0")).toBe(false);
    expect(isPrivateHost("126.255.255.255")).toBe(false);
    expect(isPrivateHost("127.255.255.255")).toBe(true);
    expect(isPrivateHost("9.255.255.255")).toBe(false);
    expect(isPrivateHost("10.255.255.255")).toBe(true);
    expect(isPrivateHost("11.0.0.0")).toBe(false);
    expect(isPrivateHost("192.167.255.255")).toBe(false);
    expect(isPrivateHost("192.169.0.0")).toBe(false);
    expect(isPrivateHost("169.253.255.255")).toBe(false);
    expect(isPrivateHost("169.255.0.0")).toBe(false);
  });

  it("treats names with dots as public", function acceptsDottedNames(): void {
    expect(isPrivateHost("media.example.net")).toBe(false);
    expect(isPrivateHost("local.example.net")).toBe(false);
    expect(isPrivateHost("example.lan.net")).toBe(false);
  });
});
