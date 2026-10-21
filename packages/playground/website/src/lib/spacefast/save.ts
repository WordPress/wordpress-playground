import type { Blueprint, PlaygroundClient } from '@wp-playground/client';
import { BlueprintReflection } from '@wp-playground/blueprints';
import type { SiteInfo } from '../state/redux/slice-sites';
import { SpacefastClient } from './api';
import type { SpacefastConnection } from './api';
import { collectSiteFiles, loadPublicSite, parseSetupBlueprint } from './site';
import { generateStaticSite } from './simply-static';

type Session = {
	client: SpacefastClient;
	connection: SpacefastConnection;
	spaceId?: string;
};

// Connections survive closing the save pane, but never leave this document's memory.
const sessions = new Map<string, Session>();

export function hasSpacefastConnection(siteId: string) {
	return sessions.has(siteId);
}

export async function saveSiteToSpacefast({
	site,
	playground,
	name,
	handoff,
	proxy,
	onProgress,
}: {
	site: SiteInfo;
	playground: PlaygroundClient;
	name: string;
	handoff: string;
	proxy: string;
	onProgress: (message: string) => void;
}) {
	const declaration = (
		await BlueprintReflection.create(
			site.metadata.originalBlueprint as Blueprint
		)
	).getDeclaration();
	const blueprint = await parseSetupBlueprint(
		JSON.stringify({
			...declaration,
			preferredVersions: {
				php: site.metadata.runtimeConfiguration.phpVersion,
				wp: site.metadata.runtimeConfiguration.wpVersion,
			},
		})
	);
	let session = sessions.get(site.metadata.id);
	if (handoff && !session) {
		onProgress('Connecting to Spacefast…');
		const client = new SpacefastClient(proxy);
		const connection = await client.connect(handoff);
		session = {
			client,
			connection,
			spaceId: site.metadata.spacefast?.spaceId,
		};
		sessions.set(site.metadata.id, session);
	}
	if (!session)
		throw new Error('Paste a Spacefast handoff URL to authorize saving.');
	let id =
		session.spaceId ||
		site.metadata.spacefast?.spaceId ||
		session.connection.spaceId;
	if (
		session.connection.kind === 'space' &&
		session.connection.spaceId !== id
	) {
		throw new Error(
			'This handoff belongs to another Space. Use a handoff for this Playground’s destination.'
		);
	}
	if (!id) {
		if (!session.connection.teamId)
			throw new Error('The handoff did not identify a team or Space.');
		onProgress('Creating your public Space…');
		const space = await session.client.createSpace(
			session.connection.teamId,
			name
		);
		id = space.id;
	}
	// Retain an allocated destination even if its first upload fails.
	session.spaceId = id;
	const space = await session.client.getSpace(id);
	if (!space.liveUrl) {
		throw new Error('Spacefast has not assigned a public URL yet.');
	}
	if (space.channels?.live?.versionId) {
		// Only replace destinations that already contain this Playground format.
		await loadPublicSite(space.liveUrl, proxy);
	}
	const generated = await generateStaticSite(
		playground,
		blueprint,
		space.liveUrl,
		proxy,
		onProgress
	);
	const { files } = await collectSiteFiles(
		playground,
		generated.blueprint,
		id,
		onProgress
	);
	files.push(...generated.files);
	const published = await session.client.publish(
		id,
		files,
		{ replace: true, deletePaths: [] },
		onProgress
	);
	if (!published.space.liveUrl)
		throw new Error('Spacefast has not assigned a public URL yet.');
	return {
		spaceId: id,
		url: published.space.liveUrl,
		blueprint: generated.blueprint,
	};
}
