import posthog from 'posthog-js'
import { browser } from '$app/environment';

export const load = async () => {
    if (browser) {
        posthog.init(
            "phc_rOMznyIIFLaEP4bK98xCjQtHCuENkqovXMbONBQ8lus",
            { api_host: "https://eu.i.posthog.com", person_profiles: "never" }
        )
    }

    return
};