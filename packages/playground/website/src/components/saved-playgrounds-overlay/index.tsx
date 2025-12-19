import css from './style.module.css';
import classNames from 'classnames';
import {
	__experimentalHStack as HStack,
	__experimentalVStack as VStack,
	FlexItem,
	Spinner,
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { close, arrowLeft, moreVertical, upload, link } from '@wordpress/icons';
import { Icon } from '@wordpress/icons';
import { GitHubIcon } from '../../github/github';
import { useDispatch } from 'react-redux';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePlaygroundClient } from '../../lib/use-playground-client';
import { importWordPressFiles } from '@wp-playground/client';
import { logger } from '@php-wasm/logger';
import {
	setActiveSite,
	useActiveSite,
	useAppDispatch,
	useAppSelector,
} from '../../lib/state/redux/store';
import store from '../../lib/state/redux/store';
import type { PlaygroundDispatch } from '../../lib/state/redux/store';
import type { SiteLogo, SiteInfo } from '../../lib/state/redux/slice-sites';
import {
	selectSortedSites,
	selectTemporarySite,
	removeSite,
} from '../../lib/state/redux/slice-sites';
import {
	modalSlugs,
	setActiveModal,
	setSiteManagerOpen,
	setSiteManagerSection,
	setSiteSlugToRename,
} from '../../lib/state/redux/slice-ui';
import { WordPressIcon } from '@wp-playground/components';
import useFetch from '../../lib/hooks/use-fetch';
import { PlaygroundRoute, redirectTo } from '../../lib/state/url/router';

type BlueprintsIndexEntry = {
	title: string;
	description: string;
	author: string;
	categories: string[];
	path: string;
	screenshot_url?: string;
	featured?: boolean;
};

interface SavedPlaygroundsOverlayProps {
	onClose: () => void;
}

type ViewMode = 'main' | 'blueprints';

// Pull Request icon from GitHub Octicons (https://github.com/primer/octicons)
function PullRequestIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
		</svg>
	);
}

// 3x3 grid icon from Bootstrap Icons (grid-3x3-gap-fill)
function GridIcon({ size = 20 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
			<path d="M1 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2zM1 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V7zM1 12a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2zm5 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2z" />
		</svg>
	);
}

function PlaygroundLogo() {
	return (
		<div className={css.logo}>
			<svg
				viewBox="0 0 124 124"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={css.logoIcon}
			>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M14.755 45.1665C12.0512 48.8962 10.6245 53.4789 10.3951 58.5153C10.358 59.3301 10.3522 60.1566 10.3774 60.9934C10.7191 72.3238 16.7432 85.5209 27.6103 96.388C44.2413 113.019 66.3294 118.307 78.8323 109.243C73.5732 108.004 68.2526 106.073 63.0136 103.496C61.6689 103.437 60.222 103.262 58.6713 102.952C56.0196 102.421 53.2158 101.511 50.3594 100.216C50.3593 100.216 50.3592 100.215 50.359 100.215C45.1354 97.8469 39.7361 94.1934 34.7704 89.2277C29.8052 84.2625 26.1519 78.8637 23.784 73.6406C23.7838 73.6405 23.7836 73.6405 23.7834 73.6404C22.4884 70.7839 21.5779 67.9798 21.0476 65.3279C20.7375 63.7776 20.5621 62.3309 20.5032 60.9865C17.9263 55.7471 15.9944 50.426 14.755 45.1665ZM4.33861 76.7002C4.71713 76.3217 5.11425 75.9686 5.52862 75.6407C6.7468 79.1965 8.35436 82.7444 10.3249 86.214C10.06 87.3833 10.0041 88.9848 10.4335 91.1319C11.2858 95.3936 13.9437 100.626 18.659 105.341C23.3743 110.056 28.6064 112.714 32.8681 113.567C35.0158 113.996 36.6176 113.94 37.787 113.675C41.2566 115.645 44.8043 117.252 48.36 118.47C48.0319 118.885 47.6786 119.283 47.2998 119.661C39.3909 127.57 23.3622 124.365 11.4988 112.501C-0.364596 100.638 -3.57033 84.6091 4.33861 76.7002ZM43.7198 80.2786C67.4466 104.005 99.5039 110.417 115.322 94.599C121.041 88.8798 123.854 81.0375 123.994 72.2337C124.239 56.6885 116.149 38.1454 101.001 22.9976C77.2746 -0.729192 45.2173 -7.14065 29.3994 8.67722C23.6725 14.4041 20.8595 22.2597 20.7271 31.078C20.4941 46.6158 28.5836 65.1423 43.7198 80.2786ZM77.1341 84.4888C77.5747 86.6917 77.7433 88.6853 77.6924 90.4738C68.7821 87.3724 59.3392 81.5782 50.88 73.119C42.4208 64.6598 36.6267 55.2171 33.5253 46.3068C35.3138 46.2559 37.3074 46.4245 39.5104 46.8651C47.0115 48.3653 55.7301 52.9069 63.4112 60.588C71.0923 68.2691 75.6339 76.9877 77.1341 84.4888ZM36.5596 15.8374C32.2725 20.1245 29.985 27.0976 31.1373 36.3235C43.2662 35.1444 58.3841 41.2404 70.5714 53.4278C82.7587 65.6151 88.8548 80.7329 87.6757 92.8617C96.9016 94.014 103.875 91.7265 108.162 87.4394C112.932 82.6694 115.226 74.5742 113.061 63.7503C110.913 53.0099 104.488 40.8048 93.8412 30.1578C83.1942 19.5108 70.9891 13.0857 60.2487 10.9376C49.4248 8.7728 41.3296 11.0674 36.5596 15.8374Z"
					fill="#e5e6e6"
				/>
			</svg>
			<span className={css.logoText}>Playground</span>
		</div>
	);
}

export function SavedPlaygroundsOverlay({
	onClose,
}: SavedPlaygroundsOverlayProps) {
	const offline = useAppSelector((state) => state.ui.offline);
	const storedSites = useAppSelector(selectSortedSites).filter(
		(site) => site.metadata.storage !== 'none'
	);
	const temporarySite = useAppSelector(selectTemporarySite);
	const activeSite = useActiveSite();
	const dispatch = useAppDispatch();
	const modalDispatch: PlaygroundDispatch = useDispatch();
	const playground = usePlaygroundClient();
	const zipFileInputRef = useRef<HTMLInputElement>(null);

	const [viewMode, setViewMode] = useState<ViewMode>('main');
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedTag, setSelectedTag] = useState<string | null>(null);
	const [isClosing, setIsClosing] = useState(false);
	const [pendingZipFile, setPendingZipFile] = useState<File | null>(null);

	const closeWithFade = (callback?: () => void) => {
		setIsClosing(true);
		setTimeout(() => {
			if (callback) {
				callback();
			}
			onClose();
		}, 200); // Match the fadeOut animation duration
	};

	// Ensure we import into a temporary site, not a saved site.
	// This effect handles the actual import once we're on a temporary site.
	const isTemporarySite = activeSite?.metadata.storage === 'none';
	useEffect(() => {
		if (!pendingZipFile || !isTemporarySite || !playground) {
			return;
		}

		const doImport = async () => {
			try {
				await importWordPressFiles(playground, {
					wordPressFilesZip: pendingZipFile,
				});
				// TODO: Do not prefetch update checks at this stage, it delays
				//       refreshing the page.
				setTimeout(async () => {
					await playground.goTo('/');
				}, 200);
				alert(
					'File imported! This Playground instance has been updated and will refresh shortly.'
				);
				onClose();
			} catch (error) {
				logger.error(error);
				alert(
					'Unable to import file. Is it a valid WordPress Playground export?'
				);
				return;
			} finally {
				setPendingZipFile(null);
				// Reset the input so the same file can be selected again
				if (zipFileInputRef.current) {
					zipFileInputRef.current.value = '';
				}
			}
		};
		doImport();
	}, [pendingZipFile, isTemporarySite, playground, onClose]);

	function switchToTemporarySite() {
		if (temporarySite) {
			// Switch to existing temporary site, then import will happen via effect
			dispatch(setActiveSite(temporarySite.slug));
		} else {
			// No temporary site exists, create one with a pushState-driven
			// redirect that will trigger the temporary site route and create
			// a new temporary site for us.
			//
			// Note it might take a moment so we won't call importWordPressFiles()
			// right away. Instead, we've stored the pendingZipFile in state, and
			// the effect above will handle the import once the temporary site loads.
			redirectTo(PlaygroundRoute.newTemporarySite());
		}
	}

	const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Always import into a temporary site, never into a saved site.
		// If we're on a saved site, switch to/create a temporary one first.
		if (!isTemporarySite) {
			setPendingZipFile(file);
			switchToTemporarySite();
			return;
		}

		if (!playground) {
			alert(
				'No active Playground to import into. Please create one first.'
			);
			return;
		}

		try {
			await importWordPressFiles(playground, { wordPressFilesZip: file });
			// TODO: Do not prefetch update checks at this stage, it delays
			//       refreshing the page.
			setTimeout(async () => {
				await playground.goTo('/');
			}, 200);
			alert(
				'File imported! This Playground instance has been updated and will refresh shortly.'
			);
			onClose();
		} catch (error) {
			logger.error(error);
			alert(
				'Unable to import file. Is it a valid WordPress Playground export?'
			);
		}

		// Reset the input so the same file can be selected again
		if (zipFileInputRef.current) {
			zipFileInputRef.current.value = '';
		}
	};

	const {
		data: blueprintsData,
		isLoading: blueprintsLoading,
		isError: blueprintsError,
	} = useFetch<Record<string, BlueprintsIndexEntry>>(
		'https://raw.githubusercontent.com/WordPress/blueprints/trunk/index.json'
	);

	const allBlueprints: BlueprintsIndexEntry[] = blueprintsData
		? Object.entries(blueprintsData).map(([path, entry]) => ({
				...entry,
				path,
			}))
		: [];

	const previewBlueprints = allBlueprints.slice(0, 5);

	// Extract all unique tags and sort by popularity (number of blueprints), then alphabetically
	const tagCounts = new Map<string, number>();
	allBlueprints.forEach((b) => {
		(b.categories || []).forEach((tag) => {
			tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
		});
	});
	const allTags = Array.from(tagCounts.keys())
		.filter((tag) => tag.substring(0, 1).match(/^[A-Z]$/))
		.sort((a, b) => {
			const countDiff = (tagCounts.get(b) || 0) - (tagCounts.get(a) || 0);
			if (countDiff !== 0) return countDiff;
			return 0;
		});

	// Filter blueprints based on search and tag
	const filteredBlueprints = allBlueprints.filter((blueprint) => {
		const query = searchQuery.toLowerCase();
		const matchesSearch =
			!searchQuery ||
			blueprint.title.toLowerCase().includes(query) ||
			blueprint.description.toLowerCase().includes(query) ||
			blueprint.categories?.some((cat) =>
				cat.toLowerCase().includes(query)
			);

		const matchesTag =
			!selectedTag ||
			(selectedTag === 'Featured'
				? blueprint.featured === true
				: blueprint.categories?.includes(selectedTag));

		return matchesSearch && matchesTag;
	});

	// Handle Escape key
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				// Check current state at event time (not from closure)
				const currentActiveModal = store.getState().ui.activeModal;
				// If a sub-modal is open, let it handle the Escape key
				if (currentActiveModal) {
					return;
				}
				// Close the entire overlay (whether in main or blueprints view)
				onClose();
			}
		},
		[onClose]
	);

	useEffect(() => {
		// Use capture phase so we can check modal state before modal handlers clear it
		document.addEventListener('keydown', handleKeyDown, true);
		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [handleKeyDown]);

	const onSiteClick = (slug: string) => {
		dispatch(setActiveSite(slug));
		dispatch(setSiteManagerSection('site-details'));
		closeWithFade();
	};

	const onTemporaryPlaygroundClick = () => {
		if (temporarySite) {
			// Switch to existing temporary playground
			dispatch(setActiveSite(temporarySite.slug));
			dispatch(setSiteManagerSection('site-details'));
			closeWithFade();
		} else {
			// Create a new temporary playground
			createVanillaSite();
		}
	};

	const getLogoDataURL = (logo: SiteLogo): string => {
		return `data:${logo.mime};base64,${logo.data}`;
	};

	const handleDeleteSite = async (site: SiteInfo, onClose: () => void) => {
		const proceed = window.confirm(
			`Are you sure you want to delete the site '${site.metadata.name}'?`
		);
		if (proceed) {
			await dispatch(removeSite(site.slug));
			onClose();
		}
	};

	const handleRenameSite = (site: SiteInfo, onClose: () => void) => {
		dispatch(setSiteSlugToRename(site.slug));
		modalDispatch(setActiveModal(modalSlugs.RENAME_SITE));
		onClose();
	};

	// const handleDownloadSite = async (
	// 	siteSlug: string,
	// 	onClose: () => void
	// ) => {
	// 	const clientInfo = selectClientInfoBySiteSlug(
	// 		{ clients: store.getState().clients },
	// 		siteSlug
	// 	);
	// 	const playground = clientInfo?.client;
	// 	if (!playground) {
	// 		return;
	// 	}
	// 	const bytes = await zipWpContent(playground, {
	// 		selfContained: true,
	// 	});
	// 	saveAs(new File([bytes], 'wordpress-playground.zip'));
	// 	onClose();
	// };

	function previewBlueprint(blueprintPath: BlueprintsIndexEntry['path']) {
		dispatch(setSiteManagerOpen(false));
		redirectTo(
			PlaygroundRoute.newTemporarySite({
				query: {
					name: 'Blueprint preview',
					'blueprint-url': `https://raw.githubusercontent.com/WordPress/blueprints/trunk/${blueprintPath.replace(
						/^\//,
						''
					)}`,
				},
			})
		);
		closeWithFade();
	}

	function createVanillaSite() {
		dispatch(setSiteManagerOpen(false));
		redirectTo(PlaygroundRoute.newTemporarySite());
		closeWithFade();
	}

	const creationOptions = [
		{
			id: 'vanilla',
			title: 'Vanilla WordPress',
			iconComponent: <WordPressIcon />,
			onClick: createVanillaSite,
			disabled: false,
		},
		{
			id: 'wp-pr',
			title: 'WordPress PR',
			iconComponent: <PullRequestIcon />,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.PREVIEW_PR_WP));
			},
			disabled: offline,
		},
		{
			id: 'gutenberg-pr',
			title: 'Gutenberg PR',
			iconComponent: <PullRequestIcon />,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.PREVIEW_PR_GUTENBERG));
			},
			disabled: offline,
		},
		{
			id: 'github',
			title: 'From GitHub',
			iconComponent: GitHubIcon,
			onClick: () => {
				if (!isTemporarySite) {
					switchToTemporarySite();
				}
				modalDispatch(setActiveModal(modalSlugs.GITHUB_IMPORT));
			},
			disabled: offline,
		},
		{
			id: 'blueprint-url',
			title: 'Blueprint URL',
			icon: link,
			onClick: () => {
				modalDispatch(setActiveModal(modalSlugs.BLUEPRINT_URL));
			},
			disabled: offline,
		},
		{
			id: 'zip',
			title: 'Import .zip',
			icon: upload,
			onClick: () => {
				zipFileInputRef.current?.click();
			},
			disabled: false,
		},
	];

	if (viewMode === 'blueprints') {
		return (
			<div
				className={classNames(css.overlay, {
					[css.overlayClosing]: isClosing,
				})}
			>
				<div className={css.fullscreenContent}>
					<div className={css.header}>
						<Button
							icon={arrowLeft}
							label="Back"
							onClick={() => {
								setViewMode('main');
								setSearchQuery('');
								setSelectedTag(null);
							}}
							className={css.backButton}
						/>
						<h1 className={css.headerTitle}>Blueprints</h1>
						<Button
							icon={close}
							label="Close"
							onClick={onClose}
							className={css.closeButton}
						/>
					</div>

					<div className={css.filtersBar}>
						<div className={css.tagsContainer}>
							<button
								className={classNames(css.tagButton, {
									[css.tagButtonActive]: selectedTag === null,
								})}
								onClick={() => setSelectedTag(null)}
							>
								All
							</button>
							<button
								className={classNames(css.tagButton, {
									[css.tagButtonActive]:
										selectedTag === 'Featured',
								})}
								onClick={() =>
									setSelectedTag(
										selectedTag === 'Featured'
											? null
											: 'Featured'
									)
								}
							>
								Featured
							</button>
							{allTags.slice(0, 8).map((tag) => (
								<button
									key={tag}
									className={classNames(css.tagButton, {
										[css.tagButtonActive]:
											selectedTag === tag,
									})}
									onClick={() =>
										setSelectedTag(
											selectedTag === tag ? null : tag
										)
									}
								>
									{tag}
								</button>
							))}
						</div>
						<div className={css.searchWrapper}>
							<div className={css.searchIcon}>
								<svg
									width="18"
									height="18"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<circle cx="11" cy="11" r="8" />
									<path d="m21 21-4.35-4.35" />
								</svg>
							</div>
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search Blueprints"
								className={css.searchField}
								autoFocus
							/>
						</div>
					</div>

					<div className={css.body}>
						<h2 className={css.sectionTitle}>
							{selectedTag || searchQuery
								? `Showing ${filteredBlueprints.length} of ${allBlueprints.length} blueprints`
								: `Showing all ${filteredBlueprints.length} blueprints`}
						</h2>
						{blueprintsLoading ? (
							<div className={css.loadingContainer}>
								<Spinner />
							</div>
						) : blueprintsError ? (
							<p className={css.emptyMessage}>
								Unable to load blueprints. Check your
								connection.
							</p>
						) : filteredBlueprints.length === 0 ? (
							<p className={css.emptyMessage}>
								No blueprints found matching your criteria.
							</p>
						) : (
							<div className={css.blueprintsFullGrid}>
								{filteredBlueprints.map((blueprint) => (
									<button
										key={blueprint.path}
										className={css.blueprintCard}
										onClick={() =>
											previewBlueprint(blueprint.path)
										}
									>
										<div className={css.blueprintThumbnail}>
											{blueprint.screenshot_url ? (
												<img
													src={
														blueprint.screenshot_url
													}
													alt=""
													loading="lazy"
												/>
											) : (
												<div
													className={
														css.blueprintPlaceholder
													}
												>
													<WordPressIcon />
												</div>
											)}
										</div>
										<div className={css.blueprintInfo}>
											<h3 className={css.blueprintTitle}>
												{blueprint.title}
											</h3>
											<p
												className={
													css.blueprintDescription
												}
											>
												{blueprint.description}
											</p>
											{blueprint.categories &&
												blueprint.categories.length >
													0 && (
													<div
														className={
															css.blueprintTags
														}
													>
														{blueprint.categories
															.slice(0, 3)
															.map((tag) => (
																<span
																	key={tag}
																	className={
																		css.blueprintTag
																	}
																>
																	{tag}
																</span>
															))}
													</div>
												)}
										</div>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={classNames(css.overlay, {
				[css.overlayClosing]: isClosing,
			})}
		>
			<input
				type="file"
				ref={zipFileInputRef}
				onChange={handleImportZip}
				accept=".zip,application/zip"
				style={{ display: 'none' }}
			/>
			<VStack className={css.fullscreenContent} spacing={0}>
				<HStack
					className={css.header}
					alignment="center"
					justify="space-between"
				>
					<FlexItem className={css.headerSpacer} />
					<PlaygroundLogo />
					<Button
						icon={close}
						label="Close"
						onClick={onClose}
						className={css.closeButton}
					/>
				</HStack>

				<div className={css.body}>
					{/* Start a new Playground */}
					<section className={css.section}>
						<h2 className={css.sectionTitle}>
							Start a new Playground
						</h2>
						<div className={css.creationRow}>
							{creationOptions.map((option) => (
								<button
									key={option.id}
									className={css.creationButton}
									onClick={option.onClick}
									disabled={option.disabled}
								>
									<span className={css.creationIcon}>
										{'iconComponent' in option ? (
											option.iconComponent
										) : (
											<Icon
												icon={option.icon}
												size={24}
											/>
										)}
									</span>
									<span className={css.creationTitle}>
										{option.title}
									</span>
								</button>
							))}
						</div>
					</section>

					{/* Start from a Blueprint */}
					<section className={css.section}>
						<div className={css.sectionHeader}>
							<h2 className={css.sectionTitle}>
								Start from a Blueprint
							</h2>
						</div>
						{blueprintsLoading ? (
							<div className={css.loadingContainer}>
								<Spinner />
							</div>
						) : blueprintsError ? (
							<p className={css.emptyMessage}>
								Unable to load blueprints. Check your
								connection.
							</p>
						) : (
							<div className={css.blueprintsRow}>
								{previewBlueprints.map((blueprint) => (
									<button
										key={blueprint.path}
										className={css.blueprintPreviewCard}
										onClick={() =>
											previewBlueprint(blueprint.path)
										}
									>
										<div
											className={
												css.blueprintPreviewThumbnail
											}
										>
											{blueprint.screenshot_url ? (
												<img
													src={
														blueprint.screenshot_url
													}
													alt=""
													loading="lazy"
												/>
											) : (
												<div
													className={
														css.blueprintPlaceholder
													}
												>
													<WordPressIcon />
												</div>
											)}
										</div>
										<span
											className={
												css.blueprintPreviewTitle
											}
										>
											{blueprint.title}
										</span>
									</button>
								))}
								<button
									className={css.blueprintPreviewCard}
									onClick={() => setViewMode('blueprints')}
								>
									<div
										className={classNames(
											css.blueprintPreviewThumbnail,
											css.viewAllThumbnail
										)}
									>
										<GridIcon size={50} />
									</div>
									<span className={css.blueprintPreviewTitle}>
										View all {allBlueprints.length}{' '}
										blueprints
									</span>
								</button>
							</div>
						)}
					</section>

					{/* Your Playgrounds */}
					<section className={css.section}>
						<h2 className={css.sectionTitle}>Your Playgrounds</h2>
						<div className={css.sitesList}>
							{/* Temporary Playground - always shown at top */}
							<div
								className={classNames(css.siteRow, {
									[css.siteRowSelected]:
										temporarySite?.slug ===
										activeSite?.slug,
								})}
							>
								<button
									className={css.siteRowContent}
									onClick={onTemporaryPlaygroundClick}
								>
									<div className={css.siteRowLogo}>
										{temporarySite?.metadata.logo ? (
											<img
												src={getLogoDataURL(
													temporarySite.metadata.logo
												)}
												alt=""
											/>
										) : (
											<WordPressIcon />
										)}
									</div>
									<div className={css.siteRowInfo}>
										<span className={css.siteRowName}>
											Unsaved Playground
										</span>
										<span className={css.siteRowDate}>
											Not saved to browser storage
										</span>
									</div>
								</button>
							</div>
							{storedSites.map((site) => {
								const isSelected =
									site.slug === activeSite?.slug;
								// const hasClient = Boolean(
								// 	selectClientInfoBySiteSlug(
								// 		{
								// 			clients:
								// 				store.getState().clients,
								// 		},
								// 		site.slug
								// 	)?.client
								// );
								return (
									<div
										key={site.slug}
										className={classNames(css.siteRow, {
											[css.siteRowSelected]: isSelected,
										})}
									>
										<button
											className={css.siteRowContent}
											onClick={() =>
												onSiteClick(site.slug)
											}
										>
											<div className={css.siteRowLogo}>
												{site.metadata.logo ? (
													<img
														src={getLogoDataURL(
															site.metadata.logo
														)}
														alt=""
													/>
												) : (
													<WordPressIcon />
												)}
											</div>
											<div className={css.siteRowInfo}>
												<span
													className={css.siteRowName}
												>
													{site.metadata.name}
												</span>
												{site.metadata.whenCreated && (
													<span
														className={
															css.siteRowDate
														}
													>
														Created{' '}
														{new Date(
															site.metadata
																.whenCreated
														).toLocaleDateString(
															undefined,
															{
																year: 'numeric',
																month: 'short',
																day: 'numeric',
															}
														)}
													</span>
												)}
											</div>
										</button>
										<DropdownMenu
											icon={moreVertical}
											label="Site actions"
											className={css.siteRowMenu}
											popoverProps={{
												placement: 'bottom-end',
											}}
										>
											{({ onClose: closeMenu }) => (
												<>
													<MenuGroup>
														<MenuItem
															onClick={() =>
																handleRenameSite(
																	site,
																	closeMenu
																)
															}
														>
															Rename
														</MenuItem>
														{/* @TODO: Add download as .zip functionality for non-loaded sites */}
														{/* <MenuItem
																onClick={() =>
																	handleDownloadSite(
																		site.slug,
																		closeMenu
																	)
																}
																disabled={
																	!hasClient
																}
															>
																Download as .zip
															</MenuItem> */}
													</MenuGroup>
													<MenuGroup>
														<MenuItem
															className={
																css.dangerMenuItem
															}
															onClick={() =>
																handleDeleteSite(
																	site,
																	closeMenu
																)
															}
														>
															Delete
														</MenuItem>
													</MenuGroup>
												</>
											)}
										</DropdownMenu>
									</div>
								);
							})}
						</div>
					</section>
				</div>
			</VStack>
		</div>
	);
}
