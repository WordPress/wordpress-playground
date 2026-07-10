import type { SiteMetadata } from '../../lib/state/redux/slice-sites';

type BlueprintFilesystemOwner = {
	metadata: Pick<
		SiteMetadata,
		'id' | 'whenCreated' | 'sourceSetupUrlFingerprint'
	>;
};

/**
 * Identifies the Blueprint storage generation owned by one site setup.
 *
 * Usage metadata may change without replacing storage. A recreation changes
 * `whenCreated`, while older sites fall back to their setup fingerprint.
 */
export function getBlueprintFilesystemIdentity(site: BlueprintFilesystemOwner) {
	if (site.metadata.whenCreated !== undefined) {
		return `${site.metadata.id}:created:${site.metadata.whenCreated}`;
	}
	if (site.metadata.sourceSetupUrlFingerprint) {
		return `${site.metadata.id}:source:${site.metadata.sourceSetupUrlFingerprint}`;
	}
	return `${site.metadata.id}:initial`;
}
