import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "hono/adapter";

import { isValidDomain } from "./utils";
import { fetchRdapUrl, fetchRdapData } from "./rdap";
import { isFeatureEnabled } from "./posthog";

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
    let domain = body.domain;

    // check if domain is provided
    if (!domain) {
        c.status(400);
        return c.text("No domain provided");
    }

    // normalize domain
    domain = domain.trim().toLowerCase();

    // check if domain is valid
    if (!isValidDomain(domain)) {
        c.status(400);
        return c.text("Invalid domain");
    }

    const { POSTHOG_API_KEY } = env<{ POSTHOG_API_KEY: string }>(c)
    const { POSTHOG_HOST } = env<{ POSTHOG_HOST: string }>(c)
    const featureCfTurnstile = await isFeatureEnabled(
        "cf-turnstile", POSTHOG_HOST, POSTHOG_API_KEY, c.req.header("cf-connecting-ip") || "anonymous"
    );
    const featureASNLookups = await isFeatureEnabled(
        "asn-lookups", POSTHOG_HOST, POSTHOG_API_KEY, c.req.header("cf-connecting-ip") || "anonymous"
    );

    if (featureCfTurnstile) {
        const turnstileResponse = body.turnstile_response;
        const remoteIP = c.req.header("cf-connecting-ip");

        // validate captcha (Cloudflare Turnstile)
        if (!turnstileResponse) {
            c.status(400);
            return c.text("No CAPTCHA response provided");
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
                return c.text("CAPTCHA validation failed – reload and try again");
            }
        }
    }

    //try {
    const tld: string = domain.split(".").pop() || "";

    let rdapUrl: string;
    try {
        rdapUrl = await fetchRdapUrl(tld);
    } catch {
        c.status(404);
        return c.text(`No RDAP server found for .${tld} TLD`);
    }

    let rdapData;
    try {
        rdapData = await fetchRdapData(rdapUrl, domain, featureASNLookups);
    } catch (error) {
        c.status(500);
        // @ts-ignore
        return c.text(error.message);
    }

    return c.json(rdapData);
});

// Apple App Attestation (A3)
app.post("/v1/a3/rdap", async (c) => {
    // pass
});

export default app;
