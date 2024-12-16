/**
 * Checks if a given domain is valid.
 *
 * @param {string} domain - The domain to validate.
 * @returns {boolean} True if the domain is valid, false otherwise.
 */
function isValidDomain(domain: string): boolean {
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]{1,63}\.)+[a-zA-Z]{2,6}$/;
    return domainRegex.test(domain);
}

function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export { isValidDomain, isValidEmail };