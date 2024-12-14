import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "hono/adapter";

import { resolveNameserversAndFetchASN } from "./asn";
import { fetchRdapUrl } from "./rdap";

const app = new Hono();

app.use(
    "/v1/*",
    cors({
        origin: "*",
        allowHeaders: ["*"],
        allowMethods: ["POST", "GET", "OPTIONS"],
        exposeHeaders: ["Content-Length"],
        maxAge: 600,
        credentials: true,
    })
);

app.get("/", (c) => {
    return c.text("rdaptastic API");
});

app.post("/v1/rdap", async (c) => {
        const body = await c.req.json();
        const full = c.req.query("full");

        // @ts-ignore
        const domain = body.domain;
		const turnstileResponse = body.turnstile_response;
		const remoteIP = c.req.header("cf-connecting-ip");

		// validate capcha (Cloudflare Turnstile)
		if (!turnstileResponse) {
			c.status(400);
			return c.text("No captcha provided");
		} else {
			const { TURNSTILE_SECRET } = env<{ TURNSTILE_SECRET: string }>(c)
			const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
			const turnstileResult = await fetch(url, {
				body: JSON.stringify({
					secret: TURNSTILE_SECRET,
					response: turnstileResponse,
					remoteip: remoteIP
				}),
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				}
			});

			const turnstileOutcome = await turnstileResult.json();

			// @ts-ignore
			if (!turnstileOutcome.success || !turnstileResult.ok) {
				c.status(403);
				return c.text("Captcha validation failed");
			}
		}

        // @ts-ignore
        if (!domain) {
            c.status(400);
            return c.text("No domain provided");
        }

        try {
            const tld: string = domain.split(".").pop() || "";

            let rdapUrl: string;
            try {
                rdapUrl = await fetchRdapUrl(tld);
            } catch {
                c.status(412);
                return c.text("No RDAP server found for TLD");
            }

            const rdapResponse = await fetch(`${rdapUrl}/domain/${domain}`);

            if (rdapResponse.status !== 200) {
				c.status(404);
                return c.text("Domain not found on RDAP service");
            }

            const rdapData = await rdapResponse.json();

            if (full) {
                // @ts-ignore
                return c.json(rdapData);
            }

            // @ts-ignore
            const status = rdapData.status;
            // @ts-ignore
            const nameservers = rdapData?.nameservers?.map((ns: { ldhName: string }) => ns.ldhName) || [];
            // lowercase the nameservers
            nameservers.forEach((ns: string, index: number) => {
                nameservers[index] = ns.toLowerCase();
            });
            // @ts-ignore
            const dnssecSigned = rdapData?.secureDNS?.delegationSigned || false;

            // @ts-ignore
            let registrarName = "";
            let registrarAbuseEmail = "";
            let registrarAbusePhone = "";

            // Locate the registrar entity
            // @ts-ignore
            const registrarEntity = rdapData.entities?.find((entity: any) =>
                entity.roles?.includes("registrar")
            );

            if (registrarEntity) {
                // Extract the Registrar Name
                const registrarVcard = registrarEntity.vcardArray?.[1];
                if (registrarVcard) {
                    const fnEntry = registrarVcard.find(
                        (entry: any) => entry[0] === "fn"
                    );
                    if (fnEntry) {
                        registrarName = fnEntry[3]; // Full Name
                    }
                }

                // Locate the abuse entity within the registrar entity
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
                            registrarAbuseEmail = emailEntry[3]; // Email
                        }

                        const phoneEntry = abuseVcard.find(
                            (entry: any) => entry[0] === "tel"
                        );
                        if (phoneEntry) {
                            registrarAbusePhone = phoneEntry[3]; // Phone
                        }
                    }
                }
            }

			let registrationEvent: string | null;
			try {
				// @ts-ignore
				registrationEvent = rdapData.events?.find(
					(event: { eventAction: string }) =>
						event.eventAction === "registration"
				)["eventDate"];
			} catch {
				registrationEvent = null;
			}

			let expirationEvent: string | null;
			try {
				// @ts-ignore
				expirationEvent = rdapData.events?.find(
					(event: { eventAction: string }) =>
						event.eventAction === "expiration"
				)["eventDate"];
			} catch {
				expirationEvent = null;
			}
			
			let lastChangedEvent: string | null;
			try {
				// @ts-ignore
				lastChangedEvent = rdapData.events?.find(
					(event: { eventAction: string }) =>
						event.eventAction === "last changed"
				)["eventDate"];
			} catch {
				lastChangedEvent = null;
			}

            const asn_result = await resolveNameserversAndFetchASN(nameservers);

            // @ts-ignore
            return c.json({
                status: status,
                registrar: {
                    name: registrarName,
                    domain: registrarAbuseEmail.split("@")[1],
                    abuse: {
                        email: registrarAbuseEmail,
                        phone: registrarAbusePhone,
                    },
                },
                dates: {
                    registered: registrationEvent,
                    expires: expirationEvent,
                    updated: lastChangedEvent,
                },
                nameservers: nameservers,
                asn: asn_result,
                dnssec: dnssecSigned,
            });
        } catch (error) {
			c.status(500);
            // @ts-ignore
            return c.text(error.message);
        }
    }
);

export default app;
