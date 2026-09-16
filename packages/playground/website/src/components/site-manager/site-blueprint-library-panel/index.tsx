import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Button,
	CheckboxControl,
	Notice,
	TextControl,
} from '@wordpress/components';
import { logger } from '@php-wasm/logger';
import {
	compileBlueprintV1,
	runBlueprintV1Steps,
	type PlaygroundClient,
	type UniversalPHP,
} from '@wp-playground/client';
import {
	type BlueprintLibraryCatalog,
	type BlueprintLibraryItem,
	type BlueprintLibrarySettings,
	loadBlueprintLibraryCatalog,
	loadBlueprintLibrarySettings,
	normalizeBlueprintLibrarySettings,
	prepareBlueprintLibraryItem,
	saveBlueprintLibrarySettings,
} from '../../../lib/blueprint-library';
import css from './style.module.css';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

type RunState = {
	itemId: string;
	status: 'running' | 'success' | 'error';
	message?: string;
};

export function SiteBlueprintLibraryPanel({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [catalog, setCatalog] = useState<BlueprintLibraryCatalog | null>(
		null
	);
	const [settings, setSettings] = useState<BlueprintLibrarySettings>(() =>
		loadBlueprintLibrarySettings()
	);
	const [query, setQuery] = useState('');
	const [catalogError, setCatalogError] = useState<string | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const [runState, setRunState] = useState<RunState | null>(null);
	const importInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		let cancelled = false;
		void loadBlueprintLibraryCatalog().then(
			(loadedCatalog) => {
				if (!cancelled) {
					setCatalog(loadedCatalog);
					setCatalogError(null);
				}
			},
			(error) => {
				if (!cancelled) {
					logger.error('Failed to load Blueprint library', error);
					setCatalogError(
						error instanceof Error
							? error.message
							: 'Could not load the Blueprint library.'
					);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		saveBlueprintLibrarySettings(settings);
	}, [settings]);

	const itemsByCategory = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		const groups = new Map<string, BlueprintLibraryItem[]>();
		for (const item of catalog?.items || []) {
			if (
				normalizedQuery &&
				!`${item.title} ${item.description} ${item.categories.join(
					' '
				)}`
					.toLowerCase()
					.includes(normalizedQuery)
			) {
				continue;
			}
			const category = item.categories[0] || 'Other';
			groups.set(category, [...(groups.get(category) || []), item]);
		}
		return [...groups.entries()];
	}, [catalog, query]);

	function updateSettings(
		updater: (
			settings: BlueprintLibrarySettings
		) => BlueprintLibrarySettings
	) {
		setSettings((currentSettings) =>
			normalizeBlueprintLibrarySettings(updater(currentSettings))
		);
	}

	function toggleAlwaysLoad(itemId: string, checked: boolean) {
		updateSettings((currentSettings) => ({
			...currentSettings,
			alwaysLoad: checked
				? [...new Set([...currentSettings.alwaysLoad, itemId])]
				: currentSettings.alwaysLoad.filter((id) => id !== itemId),
		}));
	}

	function updateSecret(inputId: string, value: string) {
		updateSettings((currentSettings) => ({
			...currentSettings,
			secrets: {
				...currentSettings.secrets,
				[inputId]: value,
			},
		}));
	}

	async function runItem(item: BlueprintLibraryItem) {
		if (!playground || runState?.status === 'running') {
			return;
		}

		const prepared = prepareBlueprintLibraryItem(item, settings);
		if (prepared.missingInputs.length > 0) {
			setRunState({
				itemId: item.id,
				status: 'error',
				message: 'Missing required secret.',
			});
			return;
		}

		setRunState({ itemId: item.id, status: 'running' });
		try {
			const compiledBlueprint = await compileBlueprintV1(
				prepared.blueprint,
				{ corsProxy: corsProxyUrl }
			);
			await runBlueprintV1Steps(
				compiledBlueprint,
				playground as UniversalPHP
			);
			setRunState({ itemId: item.id, status: 'success' });
		} catch (error) {
			logger.error('Failed to run Blueprint library item', error);
			setRunState({
				itemId: item.id,
				status: 'error',
				message:
					error instanceof Error
						? error.message
						: 'Could not run Blueprint.',
			});
		}
	}

	function exportSettings() {
		const blob = new Blob([JSON.stringify(settings, null, 2)], {
			type: 'application/json',
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'playground-blueprint-library-settings.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	async function importSettings(file: File | undefined) {
		if (!file) {
			return;
		}
		try {
			const nextSettings = normalizeBlueprintLibrarySettings(
				JSON.parse(await file.text())
			);
			setSettings(nextSettings);
			setImportError(null);
		} catch (error) {
			logger.error('Failed to import Blueprint library settings', error);
			setImportError('Could not import that JSON file.');
		} finally {
			if (importInputRef.current) {
				importInputRef.current.value = '';
			}
		}
	}

	return (
		<div className={css.libraryPanel}>
			<div className={css.toolbar}>
				<TextControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					className={css.search}
					label="Search"
					value={query}
					onChange={setQuery}
				/>
				<div className={css.toolbarActions}>
					<Button
						variant="secondary"
						onClick={() => importInputRef.current?.click()}
					>
						Import
					</Button>
					<Button variant="secondary" onClick={exportSettings}>
						Export
					</Button>
				</div>
				<input
					ref={importInputRef}
					type="file"
					accept="application/json"
					hidden
					onChange={(event) =>
						void importSettings(event.currentTarget.files?.[0])
					}
				/>
			</div>

			{catalogError && (
				<Notice status="error" isDismissible={false}>
					{catalogError}
				</Notice>
			)}
			{importError && (
				<Notice status="error" onRemove={() => setImportError(null)}>
					{importError}
				</Notice>
			)}
			{!playground && (
				<Notice status="warning" isDismissible={false}>
					Playground is still starting.
				</Notice>
			)}

			{itemsByCategory.length === 0 && !catalogError ? (
				<div className={css.empty}>No blueprints found.</div>
			) : (
				itemsByCategory.map(([category, items]) => (
					<section key={category} className={css.categoryGroup}>
						<h3 className={css.categoryHeading}>{category}</h3>
						{items.map((item) => (
							<BlueprintLibraryItemRow
								key={item.id}
								item={item}
								settings={settings}
								playground={playground}
								runState={
									runState?.itemId === item.id
										? runState
										: null
								}
								onRun={() => void runItem(item)}
								onToggleAlwaysLoad={toggleAlwaysLoad}
								onUpdateSecret={updateSecret}
							/>
						))}
					</section>
				))
			)}
		</div>
	);
}

function BlueprintLibraryItemRow({
	item,
	settings,
	playground,
	runState,
	onRun,
	onToggleAlwaysLoad,
	onUpdateSecret,
}: {
	item: BlueprintLibraryItem;
	settings: BlueprintLibrarySettings;
	playground: PlaygroundClient | undefined;
	runState: RunState | null;
	onRun: () => void;
	onToggleAlwaysLoad: (itemId: string, checked: boolean) => void;
	onUpdateSecret: (inputId: string, value: string) => void;
}) {
	const isAlwaysLoaded = settings.alwaysLoad.includes(item.id);
	const isRunning = runState?.status === 'running';
	return (
		<article className={css.item}>
			<div className={css.itemHeader}>
				<div>
					<h4 className={css.itemTitle}>{item.title}</h4>
					<p className={css.itemDescription}>{item.description}</p>
				</div>
				<Button
					variant="primary"
					disabled={!playground || isRunning}
					isBusy={isRunning}
					onClick={onRun}
				>
					Run
				</Button>
			</div>

			{item.inputs && item.inputs.length > 0 && (
				<div className={css.secretFields}>
					{item.inputs.map((input) => (
						<TextControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							key={input.id}
							label={input.label}
							type="password"
							value={settings.secrets[input.id] || ''}
							onChange={(value) =>
								onUpdateSecret(input.id, value)
							}
						/>
					))}
				</div>
			)}

			<div className={css.itemActions}>
				<CheckboxControl
					__nextHasNoMarginBottom
					label="Always load"
					checked={isAlwaysLoaded}
					onChange={(checked) => onToggleAlwaysLoad(item.id, checked)}
				/>
				{runState && runState.status !== 'running' && (
					<span className={css.runStatus}>
						{runState.status === 'success'
							? 'Done'
							: runState.message || 'Failed'}
					</span>
				)}
			</div>
		</article>
	);
}
