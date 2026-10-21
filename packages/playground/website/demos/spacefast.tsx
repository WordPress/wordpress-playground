import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
	Button,
	Notice,
	TextControl,
	TextareaControl,
} from '@wordpress/components';
import { startPlaygroundWeb } from '@wp-playground/client';
import type {
	BlueprintV1Declaration,
	PlaygroundClient,
} from '@wp-playground/client';
import { corsProxyUrl } from 'virtual:cors-proxy-url';
import { getRemoteUrl } from '../src/lib/config';
import { InlineProgress } from '../src/components/pane-loading';
import { SpacefastClient } from '../src/lib/spacefast/api';
import type { SpacefastConnection } from '../src/lib/spacefast/api';
import { extractSpacefastHandoffUrl } from '../src/lib/spacefast/handoff';
import {
	collectSiteFiles,
	collectStaticFiles,
	loadPublicSite,
	parseSetupBlueprint,
	restoreSite,
	SOURCE_DIRECTORY,
} from '../src/lib/spacefast/site';
import { joinPaths } from '@php-wasm/util';
import '../src/styles.css';
import css from './spacefast.module.css';

const initialBlueprint = JSON.stringify(
	{
		preferredVersions: { php: '8.3', wp: '6.8' },
		features: { networking: true },
		login: true,
		landingPage: '/wp-admin/',
		steps: [],
	},
	null,
	2
);

function SpacefastDemo() {
	const client = useRef(new SpacefastClient(corsProxyUrl));
	const viewport = useRef<HTMLDivElement>(null);
	const playground = useRef<PlaygroundClient>();
	const activeBlueprint = useRef<BlueprintV1Declaration>();
	const [blueprint, setBlueprint] = useState(initialBlueprint);
	const [source, setSource] = useState(
		new URL(window.location.href).searchParams.get('source') || ''
	);
	const [handoff, setHandoff] = useState('');
	const [connection, setConnection] = useState<SpacefastConnection>();
	const [spaceId, setSpaceId] = useState('');
	const [title, setTitle] = useState('My Playground');
	const [directory, setDirectory] = useState('/wordpress/static');
	const [ready, setReady] = useState(false);
	const [progress, setProgress] = useState('');
	const [error, setError] = useState('');
	const [result, setResult] = useState('');
	const busy = !!progress;

	async function perform(action: () => Promise<void>) {
		setError('');
		setResult('');
		setProgress('Starting…');
		const frame = viewport.current?.querySelector('iframe');
		if (frame) frame.inert = true;
		try {
			await action();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : 'The operation failed.'
			);
		} finally {
			setProgress('');
			const frame = viewport.current?.querySelector('iframe');
			if (frame) frame.inert = false;
		}
	}

	async function boot(setup: BlueprintV1Declaration) {
		setReady(false);
		playground.current = undefined;
		const frame = document.createElement('iframe');
		frame.title = 'WordPress Playground';
		frame.inert = true;
		viewport.current!.replaceChildren(frame);
		setProgress('Starting WordPress from the Blueprint…');
		const instance = await startPlaygroundWeb({
			iframe: frame,
			remoteUrl: getRemoteUrl().href,
			blueprint: structuredClone(setup),
			corsProxy: corsProxyUrl,
		});
		playground.current = instance;
		activeBlueprint.current = setup;
		return instance;
	}

	async function openSource() {
		setProgress('Reading public site data…');
		const site = await loadPublicSite(source, corsProxyUrl);
		const instance = await boot(site.blueprint);
		await restoreSite(instance, site, setProgress);
		setBlueprint(JSON.stringify(site.blueprint, null, 2));
		setSpaceId(site.manifest.spaceId);
		setReady(true);
		setResult(
			'Loaded into a new Playground. Local edits do not change the published site.'
		);
	}

	async function save(publishStatic: boolean) {
		if (!playground.current || !activeBlueprint.current || !connection)
			return;
		// Read output before creating a Space, so a missing export cannot leave an empty Space.
		const staticFiles = publishStatic
			? await collectStaticFiles(playground.current, directory)
			: [];
		let id = spaceId;
		let created = false;
		if (!id) {
			if (!connection.teamId)
				throw new Error('Enter the destination Space ID.');
			setProgress('Creating a public Space…');
			const space = await client.current.createSpace(
				connection.teamId,
				title
			);
			id = space.id;
			setSpaceId(id);
			created = true;
		}
		if (connection.kind === 'space' && connection.spaceId !== id) {
			throw new Error(
				'This handoff belongs to a different Space. Connect with a handoff for the destination.'
			);
		}
		const space = await client.current.getSpace(id);
		let previousUploads: string[] = [];
		if (space.channels?.live?.versionId && space.liveUrl) {
			const previous = await loadPublicSite(space.liveUrl, corsProxyUrl);
			previousUploads = previous.manifest.uploads;
		}
		const { files, manifest } = await collectSiteFiles(
			playground.current,
			activeBlueprint.current,
			id,
			setProgress
		);
		if (created && !publishStatic)
			files.push({
				path: 'index.html',
				data: new Blob(
					[
						'<!doctype html><title>Playground source</title><h1>Playground source saved</h1><p>Open this site in Playground to edit it.</p><a href="_playground/site.json">Public site data</a>',
					],
					{ type: 'text/html' }
				),
			});
		const published = await client.current.publish(
			id,
			[...files, ...staticFiles],
			{
				replace: publishStatic,
				deletePaths: previousUploads
					.filter((path) => !manifest.uploads.includes(path))
					.map((path) =>
						joinPaths(SOURCE_DIRECTORY, 'uploads', path)
					),
			},
			setProgress
		);
		if (published.space.liveUrl) setSource(published.space.liveUrl);
		setResult(
			`${publishStatic ? 'Site and static files published' : 'Site data saved'} (${published.versionId}).`
		);
	}

	return (
		<main className={css.layout}>
			<aside className={css.controls}>
				<h1>Playground + Spacefast</h1>
				<p>Public WordPress source, editable in your browser.</p>
				<section>
					<h2>Open a site</h2>
					<TextControl
						label="Public Spacefast site URL"
						value={source}
						onChange={setSource}
						disabled={busy}
					/>
					<Button
						variant="secondary"
						disabled={busy || !source}
						onClick={() => void perform(openSource)}
					>
						Load public site
					</Button>
				</section>
				<section>
					<h2>Start from a Blueprint</h2>
					<TextareaControl
						label="Setup Blueprint"
						value={blueprint}
						onChange={setBlueprint}
						rows={9}
						disabled={busy}
						help="Declare your plugins and themes here. Their files are recreated when the site opens."
					/>
					<Button
						variant="secondary"
						disabled={busy}
						onClick={() =>
							void perform(async () => {
								await boot(
									await parseSetupBlueprint(blueprint)
								);
								setSpaceId(connection?.spaceId || '');
								setSource('');
								setReady(true);
							})
						}
					>
						Start new Playground
					</Button>
				</section>
				<section>
					<h2>Save to Spacefast</h2>
					{connection ? (
						<>
							<p>
								Connected to{' '}
								{connection.kind === 'space'
									? 'a Space'
									: 'a team'}
								.
							</p>
							<Button
								variant="tertiary"
								disabled={busy}
								onClick={() => {
									client.current.disconnect();
									setConnection(undefined);
								}}
							>
								Disconnect
							</Button>
						</>
					) : (
						<>
							<TextControl
								label="Spacefast handoff URL"
								type="text"
								value={handoff}
								onChange={setHandoff}
								onPaste={(event) => {
									const url = extractSpacefastHandoffUrl(
										event.clipboardData.getData('text')
									);
									if (url) {
										event.preventDefault();
										setHandoff(url);
									}
								}}
								disabled={busy}
								autoComplete="off"
								help="Authorizes saving. Kept only for this tab session."
							/>
							<Button
								variant="secondary"
								disabled={busy || !handoff}
								onClick={() =>
									void perform(async () => {
										const url = handoff;
										const connected =
											await client.current.connect(url);
										setHandoff('');
										setConnection(connected);
										if (connected.spaceId)
											setSpaceId(connected.spaceId);
									})
								}
							>
								Connect
							</Button>
						</>
					)}
					<TextControl
						label="Destination Space ID"
						value={spaceId}
						onChange={setSpaceId}
						disabled={busy || connection?.kind === 'space'}
						help="Leave empty to create a public Space with a team handoff. Use your own Space ID to save a remix."
					/>
					{!spaceId && (
						<TextControl
							label="New Space title"
							value={title}
							onChange={setTitle}
							disabled={busy}
						/>
					)}
					<p>
						The Blueprint, complete database, and uploads will be
						publicly readable.
					</p>
					<Button
						variant="primary"
						disabled={busy || !ready || !connection}
						onClick={() => void perform(() => save(false))}
					>
						Save site data
					</Button>
				</section>
				<section>
					<h2>Publish a static site</h2>
					<p>
						Have Simply Static export to this directory, then
						publish its files.
					</p>
					<TextControl
						label="Static export directory"
						value={directory}
						onChange={setDirectory}
						disabled={busy}
						help="Use a dedicated folder outside wp-content. Set the exporter’s destination URL to your public Spacefast URL."
					/>
					<Button
						variant="secondary"
						disabled={busy || !ready || !connection}
						onClick={() => void perform(() => save(true))}
					>
						Save and publish static files
					</Button>
				</section>
				{progress && <InlineProgress message={progress} />}
				{error && (
					<Notice status="error" isDismissible={false}>
						{error}
					</Notice>
				)}
				{result && (
					<Notice status="success" isDismissible={false}>
						{result}
					</Notice>
				)}
				{source && (
					<p>
						<a href={source} target="_blank" rel="noreferrer">
							Open public site
						</a>
						{' · '}
						<a
							href={
								new URL(
									`?source=${encodeURIComponent(source)}`,
									window.location.href
								).href
							}
						>
							Open editor link
						</a>
					</p>
				)}
				<p className={css.note}>
					Save explicitly before closing. Changes to plugin or theme
					files are not saved. The setup Blueprint used to start this
					Playground is saved with its data.
				</p>
			</aside>
			<div className={css.viewport} ref={viewport} aria-busy={busy}>
				<p>Start a Playground or load a public site to begin.</p>
			</div>
		</main>
	);
}

createRoot(document.getElementById('root')!).render(<SpacefastDemo />);
