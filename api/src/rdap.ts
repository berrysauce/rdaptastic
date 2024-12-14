const fetchRdapUrl = async (tld: string) => {
	const ianaUrl = 'https://data.iana.org/rdap/dns.json';
	const response = await fetch(ianaUrl);
	const data = await response.json();
  
	// @ts-ignore
	const rdapServers = data.services.find(([domains]) => domains.includes(tld));
	if (!rdapServers) {
		if (tld === "de") {
			return "https://rdap.denic.de";
		}

		throw new Error(`No RDAP server found for TLD: ${tld}`);
	}
  
	return rdapServers[1][0]; // Return the first RDAP URL for the TLD
};

export { fetchRdapUrl }
  