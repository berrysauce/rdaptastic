type ASNInfo = {
    nameserver: string;
    ip?: string;
    asn?: string;
    description?: string;
    country?: string;
    error?: string;
};

/**
 * Resolves the IP addresses of given nameservers and fetches ASN information for each.
 *
 * @param {string[]} nameservers - The list of nameservers to resolve and fetch ASN information for.
 * @returns {Promise<ASNInfo[]>} A promise that resolves with an array of ASN information objects.
 * @throws {Error} If the DNS query or ASN fetch operation fails.
 */
async function resolveNameserversAndFetchASN(nameservers: string[]): Promise<ASNInfo[]> {
    const DNS_API = "https://cloudflare-dns.com/dns-query";
    const ASN_API = "https://ipinfo.io";
  
    const results: ASNInfo[] = await Promise.all(
      nameservers.map(async (nameserver): Promise<ASNInfo> => {
        try {
          // Step 1: Resolve Nameserver IP
          const dnsResponse = await fetch(`${DNS_API}?name=${nameserver}&type=A`, {
            headers: {
              Accept: "application/dns-json",
            },
          });
  
          if (!dnsResponse.ok) {
            throw new Error(`DNS query failed for ${nameserver}`);
          }
  
          const dnsData = await dnsResponse.json() as { Answer?: { data: string }[] };
          const ip = dnsData.Answer?.[0]?.data;
  
          if (!ip) {
            throw new Error(`No IP found for nameserver ${nameserver}`);
          }
  
          // Step 2: Fetch ASN information
          const asnResponse = await fetch(`${ASN_API}/${ip}/json`);
          if (!asnResponse.ok) {
            throw new Error(`ASN query failed for IP ${ip}`);
          }
  
          const asnData = await asnResponse.json() as { org?: string, country?: string };
          let asnInfo;

          if (!asnData.org) {
            asnInfo = ["Unknown", "Unknown"];
          }
          // @ts-ignore
          const [asn, ...org] = asnData.org?.split(" ");
          asnInfo = [asn, org.join(" ")];
  
          return {
            nameserver,
            ip,
            asn: asnInfo[0],
            description: asnInfo[1],
            country: asnData.country,
          };
        } catch (error: unknown) {
          return {
            nameserver,
            error: (error as Error).message,
          };
        }
      })
    );
  
    return results;
}
  
export { ASNInfo, resolveNameserversAndFetchASN }
  