/**
 * Social Hub — LinkedIn adapter barrel.
 *
 * Exposes the LinkedIn Publisher plus the shared REST client helpers. The
 * publisher self-reports `isConfigured()` (token + organization id) so the
 * registry can skip it cleanly when LinkedIn credentials are absent.
 */
export { LinkedInPublisher } from "./linkedin-publisher";
export { linkedinToken, organizationId, authorUrn } from "./client";
