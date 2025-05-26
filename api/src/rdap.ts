import { ASNInfo, resolveNameserversAndFetchASN } from "./asn";
import { isValidEmail } from "./utils";
import localRdapServicesFile from "./rdap_services.json";

interface RDAPServices {
	[key: string]: string;
}

interface RDAPData {
	status: string[] | null;
	registrar: {
		name: string | null;
		abuse: {
			email: string | null;
			phone: string | null;
		};
	};
	registrant: {
		kind: string | null;
		name: string | null;
		organization: string | null;
		address: string[] | null;
		country: string | null;
		contact_uri: string | null;
	};
	dates: {
		registered: string | null;
		expires: string | null;
		updated: string | null;
	};
	nameservers: string[] | null;
	asn: ASNInfo[] | null;
	dnssec: boolean | null;
}

const localRdapServices: RDAPServices = localRdapServicesFile;

/**
 * Fetches the RDAP URL for a given TLD.
 *
 * @param {string} tld - The top-level domain to fetch the RDAP URL for.
 * @returns {Promise<string>} A promise that resolves with the RDAP URL.
 * @throws {Error} If no RDAP server is found for the TLD.
 */
const fetchRdapUrl = async (tld: string): Promise<string> => {
	let rdapService: string | null = null;

	// first check if TLD is in local list
	try {
		rdapService = localRdapServices[tld] || null;
	} catch {
		// pass
	}

	// if not, request IANA list
	if (!rdapService) {
		const ianaUrl = "https://data.iana.org/rdap/dns.json";
		const response = await fetch(ianaUrl);
		const data = await response.json();
		const ianaRdapServices = (data as { services: [string[], string[]][] }).services.find(([domains]) => domains.includes(tld));
		rdapService = ianaRdapServices ? ianaRdapServices[1][0] : null;

		if (!rdapService) {
			throw new Error(`No RDAP server found for TLD (${tld})`);
		}
	}

	// remove trailing slash
	if (rdapService.endsWith("/")) {
		rdapService = rdapService.slice(0, -1);
	}

	return rdapService;
};

/**
 * Fetches RDAP data for a given domain.
 *
 * @param {string} domain - The domain to fetch RDAP data for.
 * @param {string} rdapUrl - The RDAP service URL.
 * @returns {Promise<RDAPData>} A promise that resolves with the RDAP data.
 * @throws {Error} If the fetch operation fails.
 */
const fetchRdapData = async (rdapService: string, domain: string, featureASNLookups: boolean = false): Promise<RDAPData> => {
	const rdapResponse = await fetch(`${rdapService}/domain/${domain}`);

	if (rdapResponse.status !== 200) {
		throw new Error(`Domain not found on RDAP service (${rdapResponse.status})`);
	}

	const rdapData: any = await rdapResponse.json();

	// get status
	const status = rdapData.status;

	// get registrar
	let registrarData: RDAPData["registrar"] = {
		name: null,
		abuse: {
			email: null,
			phone: null,
		}
	};

	// locate the registrar entity
	const registrarEntity = rdapData.entities?.find((entity: any) =>
		entity.roles?.includes("registrar")
	);

	if (registrarEntity) {
		// extract the Registrar Name
		const registrarVcard = registrarEntity.vcardArray?.[1];
		if (registrarVcard) {
			const fnEntry = registrarVcard.find(
				(entry: any) => entry[0] === "fn"
			);
			if (fnEntry) {
				registrarData.name = fnEntry[3]; // Full Name
			}
		}

		// locate the abuse entity within the registrar entity
		const abuseEntity = registrarEntity.entities?.find(
			(entity: any) => entity.roles?.includes("abuse")
		);

		if (abuseEntity) {
			const abuseVcard = abuseEntity.vcardArray?.[1];
			if (abuseVcard) {
				const emailEntry = abuseVcard.find(
					(entry: any) => entry[0] === "email"
				);
				if (emailEntry) {
					registrarData.abuse.email = emailEntry[3].replace("mailto:", ""); // email
					if (registrarData.abuse.email == "") { registrarData.abuse.email = null; }
				}

				const phoneEntry = abuseVcard.find(
					(entry: any) => entry[0] === "tel"
				);
				if (phoneEntry) {
					registrarData.abuse.phone = phoneEntry[3].replace("tel:", ""); // phone
					if (registrarData.abuse.phone == "") { registrarData.abuse.phone = null; }
				}
			}
		}
	}

	// get registrant
	let registrantData: RDAPData["registrant"] = {
		kind: null,
		name: null,
		organization: null,
		address: [] as string[],
		country: null,
		contact_uri: null
	}

	// try to locate the registrant entity (in registrar RDAP data)
	let rdapRegistrarData: any = null;
	if (rdapData.entities?.find((entity: any) =>
		entity.roles?.includes("registrant")
	)) {
		rdapRegistrarData = rdapData;	
	} else {
		// fetch registrar data (if available, through additional RDAP service link)
		try {
			if (rdapData.links && rdapData.links.length > 1) {
				const rdapRegistryResponse = await fetch(rdapData.links[1].href);
				rdapRegistrarData = await rdapRegistryResponse.json();
			}
		} catch {
			// pass
		}
	}

	if (rdapRegistrarData) {
		// locate the registrant entity (in registrar RDAP data)
		const registrantEntity = rdapRegistrarData.entities?.find((entity: any) =>
			entity.roles?.includes("registrant")
		);

		if (registrantEntity) {
			// extract the registrant data
			const registrantVcard = registrantEntity.vcardArray?.[1];

			if (registrantVcard) {
				const kindEntry = registrantVcard.find(
					(entry: any) => entry[0] === "kind"
				);
				if (kindEntry) {
					registrantData.kind = kindEntry[3];
				}

				const fnEntry = registrantVcard.find(
					(entry: any) => entry[0] === "fn"
				);
				if (fnEntry) {
					registrantData.name = fnEntry[3];
				}

				const organizationEntry = registrantVcard.find(
					(entry: any) => entry[0] === "org"
				);
				if (organizationEntry) {
					registrantData.organization = organizationEntry[3];
				}

				const addressEntry = registrantVcard.find(
					(entry: any) => entry[0] === "adr"
				);
				if (addressEntry) {
					registrantData.country = addressEntry[1]["cc"];
					registrantData.address = addressEntry[3];

					// remove empty or null entries from address
					if (registrantData.address) {
						registrantData.address = registrantData.address.filter(
							(entry: string | null) => typeof entry === "string" && entry.trim()
						);
					}

					// get registrant country from address if not found
					if (registrantData.address && !registrantData.country) {
						// get length of last element of address
						const lastElement = registrantData.address[registrantData.address.length - 1];

						// check if last element could be a country code
						if (lastElement && lastElement.length === 2) {
							registrantData.country = lastElement.toUpperCase();
							registrantData.address.pop(); // remove country code from address
						}
					}

					if (registrantData.address && registrantData.country) {
						// remove country code from address
						// this applies if registrant country is set but also included in address
						registrantData.address = registrantData.address.filter(
							(entry: string) => entry !== registrantData.country
						);
					}

					if (registrantData.address != null && registrantData.address.length === 0) {
						registrantData.address = null; // set to null if no address fields found
					}
				}

				const contactEntry = registrantVcard.find(
					(entry: any) => entry[0] === "contact-uri"
				);
				if (contactEntry) {
					registrantData.contact_uri = contactEntry[3];

					if (registrantData.contact_uri && isValidEmail(registrantData.contact_uri) && !registrantData.contact_uri.startsWith("mailto:")) {
						registrantData.contact_uri = `mailto:${registrantData.contact_uri}`;
					}
				}
			}
		}
	}

	// get dates
	let datesData = {
		registered: null,
		expires: null,
		updated: null,
	}

	datesData.registered = rdapData.events
		?.find((event: { eventAction: string }) => event.eventAction === "registration")
		?.eventDate || null;

	datesData.expires = rdapData.events
		?.find((event: { eventAction: string }) => event.eventAction === "expiration")
		?.eventDate || null;

	datesData.updated = rdapData.events
		?.find((event: { eventAction: string }) => event.eventAction === "last changed")
		?.eventDate || null;

	// get nameservers
	// and lowercase them
	const nameserverData = rdapData?.nameservers?.map((ns: { ldhName: string }) => ns.ldhName) || [];
	nameserverData.forEach((ns: string, index: number) => {
		nameserverData[index] = ns.toLowerCase();
	});

	// fetch ASN data (feature flag)
	let asnData: ASNInfo[] | null;
	if (featureASNLookups) {
		asnData = await resolveNameserversAndFetchASN(nameserverData);
	} else {
		asnData = null;
	}

	// get DNSSEC status
	const dnssecSigned = rdapData?.secureDNS?.delegationSigned || false;

	let result: RDAPData = {
		status: status,
		registrar: registrarData,
		registrant: registrantData,
		dates: datesData,
		nameservers: nameserverData,
		asn: asnData,
		dnssec: dnssecSigned,
	};

	return result;
};

export { fetchRdapUrl, fetchRdapData };
