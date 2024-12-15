<script lang="ts">
    import {
        IconSearch,
        IconExclamationCircle,
        IconAlertCircleFilled, 
        IconDiscountCheckFilled,
        IconRefreshAlert,
        IconShieldChevron,
        IconShield,
        IconEyeOff,
        IconWorld,
        IconMailExclamation,
        IconCake,
    } from "@tabler/icons-svelte";
    import { differenceInDays } from "date-fns";
    import { posthog } from "posthog-js";

    const colorSuccess = "#26931d";
    const colorError = "#d72323";

    const currentYear = new Date().getFullYear();

    let feature_cf_turnstile: boolean = $state(false);
    posthog.onFeatureFlags(() => {
        posthog.isFeatureEnabled("cf-turnstile") ? feature_cf_turnstile = true : false;
    })

    interface Result {
        status: Array<string>;
        registrar: {
            name: string;
            domain: string;
            abuse: {
                email: string;
                phone: string;
            };
        };
        dates: {
            registered: string | null;
            updated: string | null;
            expires: string | null;
        };
        nameservers: Array<string>;
        asn: Array<{
            nameserver: string;
            ip: string;
            asn: string;
            description: string;
            country: string;
        }>;
        dnssec: boolean;
    }

    let domain: string | null = $state(null);
    let result: Result | null = $state(null);
    let resultLoading: boolean = $state(false);
    let resultError: string | null = $state(null);

    // @ts-ignore
    async function handleSubmit(event) {
        result = null;
        resultError = null;
        resultLoading = true;

        let turnstileResponse = null;
        if (feature_cf_turnstile) {
            let formData = new FormData(event.target);
            turnstileResponse = formData.get("cf-turnstile-response");
            console.log("CF Turnstile response", turnstileResponse);
        }

        event.preventDefault(); // Prevent form submission

        try {
            if (feature_cf_turnstile && !turnstileResponse) {
                throw new Error("captcha")
            }

            const response = await fetch("https://api.rdaptastic.com/v1/rdap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ 
                    domain: domain,
                    turnstile_response: turnstileResponse,
                }),
            });

            if (response.status !== 200) {
                if (response.status == 403) {
                    throw new Error("captcha")
                } else if (response.status == 404) {
                    throw new Error("no_domain")
                } else if (response.status == 412) {
                    throw new Error("no_service")
                } else {
                    throw new Error("unknown");
                }
            }

            result = await response.json();
        } catch (error) {
            resultError = (error as Error)?.message || "unknown"
        } finally {
            resultLoading = false;

            if (feature_cf_turnstile) {
                // @ts-ignore
                window.turnstile.reset(); // Reset the Turnstile widget
            }
        }
    };

    function formatDate(isoDate: string) {
        const date = new Date(isoDate);

        // Format the date part
        const formattedDate = new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(date);

        // Format the time part
        const formattedTime = date.toTimeString().split(' ')[0]; // Extract HH:MM:SS from time

        // Combine into the desired format
        return `${formattedDate} (${formattedTime})`;
    }

    function daysSince(isoDate: string) {
        return differenceInDays(new Date(), new Date(isoDate));
    }

    function daysUntil(isoDate: string) {
        return differenceInDays(new Date(isoDate), new Date());
    }
</script>

<section class="py-4 py-xl-5">
    <div class="container" style="max-width: 600px;">
        <div class="text-center p-4 p-lg-5">
            <div class="row" style="margin-bottom: -24px;">
                <div class="col-xl-4">
                    <div class="text-start" style="margin-bottom: 24px;">
                        <img class="img-fluid" alt="RDAPtastic" src="/img/logo.webp" style="max-height: 70px;">
                    </div>
                </div>
                <div class="col">
                    <p class="text-start" style="font-size: 12px;margin-bottom: 0px;">rdaptastic.com is a RDAP (successor of WHOIS) lookup tool, that sums up a domains registry information nicely, displays historical changes, and can update you when something changes.</p>
                </div>
            </div>

            <!-- FORM -->
            <form style="margin-bottom: 32px;margin-top: 48px;" onsubmit={handleSubmit}>
                <div class="input-group">
                    <input class="form-control" type="text" bind:value={domain} style="padding: 8px 16px;border-radius: 0px;background: rgba(255,255,255,0);border-top-right-radius: 0px;border-bottom-right-radius: 0px;outline: 0px !important;box-shadow: none !important;border: 2px solid rgb(0,0,0);border-right-style: none;font-weight:500;" placeholder="example.com" name="domain" required>
                    {#if feature_cf_turnstile}
                        <!-- Invisible Turnstile -->
                        <div
                            class="cf-turnstile"
                            data-sitekey="0x4AAAAAAA2Mra45KtkZeImy"
                        ></div>
                    {/if}
                    <button class="btn btn-primary float-end" type="submit" style="border-radius: 0px;background: rgb(0,0,0);border-top-left-radius: 0px;border-bottom-left-radius: 0px;margin-left: -2px;padding: 8px 16px;color: rgb(255,255,255);outline: 0px !important;box-shadow: none !important;border: 2px solid rgb(0,0,0);">
                        <IconSearch size={18} stroke={2} class="mb-1" style="margin-right: 4px;" />
                        Check
                    </button>
                    <div id="turnstile-container"></div>
                </div>
            </form>

            {#if resultLoading && !resultError && !result}
                <div class="text-start" style="margin-top: 64px;margin-bottom: 64px;padding: 16px 0px;">
                    <p style="text-align: center;font-weight: 500;"><span class="spinner-border spinner-border-sm" role="status" style="width: 20px;height: 20px;margin-bottom: -2px;margin-right: 12px;border-width: 2px;"></span>Contacting RDAP service</p>
                </div>
            {/if}

            {#if resultError && !resultLoading && !result}
                <div class="text-start" style="margin-top: 64px;margin-bottom: 64px;padding: 16px 0px;">
                    {#if resultError == "captcha"}
                        <p style="text-align: center;font-weight: 500;margin-bottom: 0px;">
                            <IconExclamationCircle size={24} stroke={2} color={colorError} class="mb-1" style="margin-right: 8px;" />
                            CAPTCHA failed – please reload and try again
                        </p>
                    {:else if resultError == "no_service"}
                        <p style="text-align: center;font-weight: 500;margin-bottom: 0px;">
                            <IconExclamationCircle size={24} stroke={2} color={colorError} class="mb-1" style="margin-right: 8px;" />
                            No RDAP service found for TLD
                        </p>
                    {:else if resultError == "no_domain"}
                        <p style="text-align: center;font-weight: 500;margin-bottom: 0px;">
                            <IconExclamationCircle size={24} stroke={2} color={colorError} class="mb-1" style="margin-right: 8px;" />
                            Domain not found on RDAP service
                        </p>
                    {:else}
                        <p style="text-align: center;font-weight: 500;margin-bottom: 0px;">
                            <IconExclamationCircle size={24} stroke={2} color={colorError} class="mb-1" style="margin-right: 8px;" />
                            Error retrieving RDAP data
                        </p>
                    {/if}

                    <!--
                    <p style="text-align: center;font-weight: 500;margin-bottom: 0px;">
                        <IconExclamationCircle size={24} stroke={2} color={colorError} class="mb-1" style="margin-right: 8px;" />
                        Request rate-limited
                    </p>
                    -->
                </div>
            {/if}

            <!-- RESULTS -->
            {#if result && !resultLoading && !resultError}
                <div class="text-start" style="margin-top: 64px;margin-bottom: 64px;">

                    <!-- STATUS -->
                    <div style="margin-bottom: 8px;border-width: 2px;border-top-style: solid;border-top-color: rgb(0,0,0);">
                        <div class="row" style="margin-top: 16px;">
                            <div class="col-md-4 col-xl-4">
                                <h2 class="fs-5" style="font-weight: 500;letter-spacing: -0.5px;color: rgb(0,0,0);margin-bottom: 16px;">Status</h2>
                            </div>

                            <div class="col">
                                <!-- Status notification -->
                                <ul class="list-unstyled mt-1">
                                    {#if 
                                        (result.dates.expires && daysUntil(result.dates.expires) < 30) ||
                                        !result.dnssec
                                    }
                                        <li class="text-break" style="margin-bottom: 16px;font-weight: 700;color: {colorError};font-size: 14px;">
                                            <IconAlertCircleFilled size={20} stroke={2} class="mb-1" style="margin-right: 6px;" />
                                            ISSUE(S) DETECTED
                                        </li>
                                    {:else}
                                        <li class="text-break" style="margin-bottom: 16px;font-weight: 700;color: {colorSuccess};font-size: 14px;">
                                            <IconDiscountCheckFilled size={21} stroke={2} class="mb-1" style="margin-right: 6px;" />
                                            NO ISSUES DETECTED
                                        </li>
                                    {/if}
                                </ul>

                                <!-- Status details -->
                                <ul class="list-unstyled">
                                    {#if result.dates.expires && daysUntil(result.dates.expires) < 30}
                                        <li class="text-break" style="margin-bottom: 6px;/*font-weight: 600;*/font-size: 14px;">
                                            <IconRefreshAlert size={20} stroke={2} color={colorError} class="mb-1" style="margin-right: 6px;" />
                                            Expires in <span style="font-weight: 600;">{daysUntil(result.dates.expires)} days</span>
                                        </li>
                                    {/if}

                                    {#if !result.dnssec}
                                        <li class="text-break" style="margin-bottom: 6px;font-size: 14px;">
                                            <IconShieldChevron size={20} stroke={2} color={colorError} class="mb-1" style="margin-right: 6px;" />
                                            <span style="font-weight: 600;">DNSSEC</span> unsigned
                                        </li>
                                    {/if}

                                    {#if result.dnssec}
                                        <li class="text-break" style="margin-bottom: 6px;font-size: 14px;">
                                            <IconShieldChevron size={20} stroke={2} color={colorSuccess} class="mb-1" style="margin-right: 6px;" />
                                            <span style="font-weight: 600;">DNSSEC</span> signed
                                        </li>
                                    {/if}
                                    
                                    {#if "client transfer prohibited" in result.status}
                                        <li class="text-break" style="margin-bottom: 6px;font-size: 14px;">
                                            <IconShield size={20} stroke={2} color={colorSuccess} class="mb-1" style="margin-right: 6px;" />
                                            <span style="font-weight: 600;">Transfer-Lock</span> detected
                                        </li>
                                    {/if}

                                    <!--
                                    <li class="text-break" style="margin-bottom: 4px;font-size: 14px;">
                                        <IconEyeOff size={20} stroke={2} color={colorSuccess} class="mb-1" style="margin-right: 6px;" />
                                        <span style="font-weight: 600;">WHOIS-Privacy</span> detected
                                    </li>
                                    -->
                                </ul>
                            </div>
                        </div>
                    </div>

                    <!-- REGISTRAR -->
                    {#if result.registrar.name}
                        <div style="margin-bottom: 16px;border-width: 2px;border-top-style: solid;border-top-color: rgb(0,0,0);">
                            <div class="row" style="margin-top: 16px;">
                                <div class="col-md-4 col-xl-4">
                                    <h2 class="fs-5" style="font-weight: 500;letter-spacing: -0.5px;color: rgb(0,0,0);margin-bottom: 16px;">Registrar</h2>
                                </div>
                                <div class="col">
                                    <ul class="list-unstyled">
                                        <!-- Name & domain -->
                                        <li class="text-break" style="margin-bottom: 16px;font-weight: 600;font-size: 14px;">{result.registrar.name}</li>
                                        <li class="text-break text-lowercase" style="margin-bottom: 6px;font-size: 14px;">
                                            {#if result.registrar.domain}
                                                <IconWorld size={20} stroke={2} class="mb-1" style="margin-right: 6px;" />
                                                {result.registrar.domain}
                                            {/if}
                                        </li>
                                        <!-- Abuse contacts -->
                                        {#if result.registrar.abuse.email || result.registrar.abuse.phone}
                                            <li class="text-break" style="margin-bottom: 4px;font-size: 14px;">
                                                <IconMailExclamation size={20} stroke={2} class="mb-1" style="margin-right: 6px;" />
                                                Abuse
                                                {#if result.registrar.abuse.email}
                                                    <a href="mailto:{result.registrar.abuse.email}" style="color: inherit;font-weight: 500;">Email</a>
                                                {/if}
                                                {#if result.registrar.abuse.email && result.registrar.abuse.phone}
                                                    <span style="color: rgba(33, 37, 41, 0.5);"> / </span>
                                                {/if}
                                                {#if result.registrar.abuse.phone}
                                                    <a href="{result.registrar.abuse.phone}" style="color: inherit;font-weight: 500;">Phone</a>
                                                {/if}
                                            </li>
                                        {/if}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    {/if}

                    <!-- DATES -->
                    <div style="margin-bottom: 16px;border-width: 2px;border-top-style: solid;border-top-color: rgb(0,0,0);">
                        <div class="row" style="margin-top: 16px;">
                            <div class="col-md-4 col-xl-4">
                                <h2 class="fs-5" style="font-weight: 500;letter-spacing: -0.5px;color: rgb(0,0,0);margin-bottom: 16px;">Dates</h2>
                            </div>
                            <div class="col">
                                <!-- Age -->
                                {#if result.dates.registered}
                                    <ul class="list-unstyled">
                                        <li class="text-break" style="margin-bottom: 4px;font-size: 14px;font-weight: 600;">
                                            <IconCake size={20} stroke={2} class="mb-1" style="margin-right: 6px;" />
                                            <span>{daysSince(result.dates.registered)}</span> days old
                                        </li>
                                    </ul>
                                {/if}
                                
                                <!-- Registered on -->
                                {#if result.dates.registered}
                                    <span class="text-truncate" style="font-weight: 500;font-size: 14px;">Registered on</span>
                                    <ul class="list-unstyled" style="background: #f9f9f9;border: 1px solid rgb(224,224,224);border-radius: 0px;padding: 6px 12px;color: rgba(33,37,41,0.8);margin-top: 4px;margin-bottom: 6px;">
                                        <li class="text-break" style="margin-bottom: 0px;font-family: 'Roboto Mono', monospace;font-size: 14px;line-height: 24px;font-weight: 400;">{formatDate(result.dates.registered)}</li>
                                    </ul>
                                {/if}
                                
                                <!-- Last update -->
                                {#if result.dates.updated}
                                    <span class="text-truncate" style="font-weight: 500;font-size: 14px;">Last updated on</span>
                                    <ul class="list-unstyled" style="background: #f9f9f9;border: 1px solid rgb(224,224,224);border-radius: 0px;padding: 6px 12px;color: rgba(33,37,41,0.8);margin-top: 4px;margin-bottom: 6px;">
                                        <li class="text-break" style="margin-bottom: 0px;font-family: 'Roboto Mono', monospace;font-size: 14px;line-height: 24px;font-weight: 400;">{formatDate(result.dates.updated)}</li>
                                    </ul>
                                {/if}
                                
                                <!-- Expires on -->
                                {#if result.dates.expires}
                                    <span class="text-truncate" style="font-weight: 500;font-size: 14px;">Expires on</span>
                                    <ul class="list-unstyled" style="background: #f9f9f9;border: 1px solid rgb(224,224,224);border-radius: 0px;padding: 6px 12px;color: rgba(33,37,41,0.8);margin-top: 4px;">
                                        <li class="text-break" style="margin-bottom: 0px;font-family: 'Roboto Mono', monospace;font-size: 14px;line-height: 24px;font-weight: 400;">{formatDate(result.dates.expires)}</li>
                                    </ul>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- NAMESERVERS -->
                    <div style="margin-bottom: 16px;border-width: 2px;border-top-style: solid;border-top-color: rgb(0,0,0);">
                        <div class="row" style="margin-top: 16px;">
                            <div class="col-md-4 col-xl-4">
                                <h2 class="fs-5" style="font-weight: 500;letter-spacing: -0.5px;color: rgb(0,0,0);margin-bottom: 16px;">Nameservers</h2>
                            </div>
                            <div class="col">
                                <!-- Nameservers -->
                                <ul class="list-unstyled mt-1" style="background: #f9f9f9;border: 1px solid rgb(224,224,224);border-radius: 0px;padding: 6px 12px;color: rgba(33,37,41,0.8);">
                                    <li class="text-break text-lowercase" style="margin-bottom: 0px;font-family: 'Roboto Mono', monospace;font-size: 14px;line-height: 24px;font-weight: 400;">
                                        {#each result.nameservers as nameserver}
                                            {nameserver}<br>
                                        {/each}
                                    </li>
                                </ul><span class="text-truncate" style="font-weight: 500;font-size: 14px;">Nameserver ASNs</span>
                                
                                <!-- Nameserver ASNs -->
                                <ul class="list-unstyled" style="background: #f9f9f9;border: 1px solid rgb(224,224,224);border-radius: 0px;padding: 6px 12px;color: rgba(33,37,41,0.8);margin-top: 4px;">
                                    <li class="text-break" style="margin-bottom: 0px;font-family: 'Roboto Mono', monospace;font-size: 14px;line-height: 24px;font-weight: 400;">
                                        {#each result.asn as asn}
                                            <img class="mb-1" src="https://flagcdn.com/16x12/{asn.country.toLowerCase()}.webp" alt="{asn.country}"> {asn.description} {asn.asn}<br>
                                        {/each}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            <footer class="text-start" style="margin-top: 32px;padding-top: 24px;">
                <p style="color: rgb(174,174,174);font-size: 12px;">Copyright © {currentYear} <a href="https://berrysauce.dev" style="color: inherit;">berrysauce<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icon-tabler-arrow-up-right" style="margin-top: -2px;margin-left: 1px;">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                                <path d="M17 7l-10 10"></path>
                                <path d="M8 7l9 0l0 9"></path>
                            </svg></a></p>
                <p style="color: rgb(174,174,174);font-size: 12px;">Usage of this service is permitted under its <a href="#" style="color: inherit;">Fair-use-Policy</a>. Traffic which does not comply with this policy or the <a href="#" style="color: inherit;">Terms of Service</a> will be blocked. <a href="https://github.com/berrysauce/ingredients/blob/main/LICENSE.md" style="color: inherit;">View the license for this service here</a>. No personal data is collected when using this service.</p>
            </footer>
        </div>
    </div>
</section>
