async function getDecisions(
    host: string, apiKey: string, distinctId: string
) {
    if (!host || !apiKey || !distinctId) {
        return {};
    }

    const url = `${host}/decide?v=3`;

    const body = {
        api_key: apiKey,
        distinct_id: distinctId,
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }

        const data: object = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch PostHog decisions:", error);
        throw error;
    }
}

async function isFeatureEnabled(
    flag: string, host: string, apiKey: string, distinctId: string, defaultValue: boolean = false
) {
    if (!host || !apiKey || !distinctId) {
        return defaultValue;
    }

    const decisions: { featureFlags?: { [key: string]: boolean } } = await getDecisions(host, apiKey, distinctId);
    const flagValue = decisions.featureFlags?.[flag];
    return flagValue || defaultValue;
}

export { getDecisions, isFeatureEnabled };