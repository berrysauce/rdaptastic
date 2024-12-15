import posthog from 'posthog-js'
import { browser } from '$app/environment';

export const load = async () => {

    const POSTHOG_API_KEY = import.meta.env.POSTHOG_API_KEY;
    const POSTHOG_HOST = import.meta.env.POSTHOG_HOST;

    if (browser) {
        posthog.init(
            POSTHOG_API_KEY,
            { api_host: POSTHOG_HOST, person_profiles: "never" }
        )
    }

    return
};