import type { Blueprint, PlaygroundClient } from '@wp-playground/client';
import { BlueprintReflection } from '@wp-playground/blueprints';
import { joinPaths } from '@php-wasm/util';
import type { SiteInfo } from '../state/redux/slice-sites';
import { SpacefastClient } from './api';
import type { SpacefastConnection } from './api';
import {
	collectSiteFiles,
	loadPublicSite,
	parseSetupBlueprint,
	SOURCE_DIRECTORY,
} from './site';

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
	if (handoff) {
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
	let previousUploads: string[] = [];
	if (space.channels?.live?.versionId && space.liveUrl) {
		previousUploads = (await loadPublicSite(space.liveUrl, proxy)).manifest
			.uploads;
	}
	const { files, manifest } = await collectSiteFiles(
		playground,
		blueprint,
		id,
		onProgress
	);
	if (!space.channels?.live?.versionId) {
		files.push({
			path: 'index.html',
			data: new Blob(
				[
					'<!doctype html><title>Playground source</title><h1>Playground source saved</h1><p>This Space holds the public Blueprint, database, and uploads for a WordPress Playground.</p><a href="_playground/site.json">Public site data</a>',
				],
				{ type: 'text/html' }
			),
		});
	}
	const published = await session.client.publish(
		id,
		files,
		{
			replace: false,
			deletePaths: previousUploads
				.filter((path) => !manifest.uploads.includes(path))
				.map((path) => joinPaths(SOURCE_DIRECTORY, 'uploads', path)),
		},
		onProgress
	);
	if (!published.space.liveUrl)
		throw new Error('Spacefast has not assigned a public URL yet.');
	return { spaceId: id, url: published.space.liveUrl };
}
