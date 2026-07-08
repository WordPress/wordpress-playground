import { useEffect, useRef, useState } from 'react';
import { Button } from '@wordpress/components';
import { external } from '@wordpress/icons';
import css from './style.module.css';
import {
	type PlaygroundClient,
	type UniversalPHP,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/client';
import {
	getPhpMyAdminInstallSteps,
	PHPMYADMIN_ENTRY_PATH,
	PHPMYADMIN_INSTALL_PATH,
	PHPMYADMIN_VERSION,
} from '@wp-playground/tools';
import { logger } from '@php-wasm/logger';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

const REQUIRED_PHPMYADMIN_FILES = [
	`${PHPMYADMIN_INSTALL_PATH}/index.php`,
	`${PHPMYADMIN_INSTALL_PATH}/config.inc.php`,
	`${PHPMYADMIN_INSTALL_PATH}/libraries/classes/Dbal/DbiMysqli.php`,
];

async function installPhpMyAdmin(playground: PlaygroundClient) {
	await removeDirectoryIfExists(playground, PHPMYADMIN_INSTALL_PATH);
	await removeDirectoryIfExists(
		playground,
		`/tmp/phpMyAdmin-${PHPMYADMIN_VERSION}-english`
	);
	const steps = await getPhpMyAdminInstallSteps();
	const blueprint = await compileBlueprintV1(
		{ steps },
		{ corsProxy: corsProxyUrl }
	);
	await runBlueprintV1Steps(blueprint, playground as UniversalPHP);
}

async function removeDirectoryIfExists(
	playground: PlaygroundClient,
	path: string
) {
	if (await playground.isDir(path).catch(() => false)) {
		await playground.rmdir(path, { recursive: true });
	}
}

export function PhpMyAdminButton({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
	const [error, setError] = useState<string | null>(null);
	const playgroundRef = useRef(playground);
	const readyPlaygroundRef = useRef<PlaygroundClient | null>(null);
	playgroundRef.current = playground;

	useEffect(() => {
		if (!playground) {
			readyPlaygroundRef.current = null;
			setState('idle');
			setError(null);
			return;
		}
		const currentPlayground: PlaygroundClient = playground;
		let cancelled = false;
		readyPlaygroundRef.current = null;
		setState('idle');
		setError(null);

		async function detectPhpMyAdmin() {
			try {
				const isReady = (
					await Promise.all(
						REQUIRED_PHPMYADMIN_FILES.map((path) =>
							currentPlayground.fileExists(path)
						)
					)
				).every(Boolean);
				if (cancelled) return;
				readyPlaygroundRef.current = isReady ? currentPlayground : null;
				setState(isReady ? 'ready' : 'idle');
			} catch (error) {
				logger.error('Could not detect phpMyAdmin installation', error);
				if (!cancelled) {
					readyPlaygroundRef.current = null;
					setState('idle');
				}
			}
		}

		void detectPhpMyAdmin();
		return () => {
			cancelled = true;
		};
	}, [playground]);

	const handleOpenPhpMyAdmin = async () => {
		if (!playground) {
			return;
		}

		if (state === 'loading') {
			return;
		}
		const isReadyForCurrentPlayground =
			state === 'ready' && readyPlaygroundRef.current === playground;

		setError(null);
		const targetWindow = window.open('about:blank', '_blank');
		if (!targetWindow) {
			setError(
				'The browser blocked the phpMyAdmin popup. Please allow popups and try again.'
			);
			return;
		}
		targetWindow.opener = null;

		if (!isReadyForCurrentPlayground) {
			setState('loading');
			try {
				await installPhpMyAdmin(playground);
				if (playgroundRef.current !== playground) {
					targetWindow.close();
					return;
				}
				readyPlaygroundRef.current = playground;
				setState('ready');
			} catch (error) {
				targetWindow.close();
				if (playgroundRef.current !== playground) {
					return;
				}
				logger.error('Could not install phpMyAdmin', error);
				readyPlaygroundRef.current = null;
				setState('idle');
				setError(
					error instanceof Error ? error.message : 'Unknown error'
				);
				return;
			}
		}

		let playgroundUrl: string | undefined;
		try {
			playgroundUrl = await playground.absoluteUrl;
			if (playgroundRef.current !== playground) {
				targetWindow.close();
				return;
			}
		} catch (error) {
			targetWindow.close();
			if (playgroundRef.current !== playground) {
				return;
			}
			logger.error('Could not open phpMyAdmin', error);
			setError(error instanceof Error ? error.message : 'Unknown error');
			return;
		}
		if (playgroundUrl) {
			const phpMyAdminUrl = `${playgroundUrl}/phpmyadmin${PHPMYADMIN_ENTRY_PATH}`;
			targetWindow.location.href = phpMyAdminUrl;
		} else {
			targetWindow.close();
			setError('Could not determine the Playground URL.');
		}
	};

	const isLoading = state === 'loading';
	return (
		<>
			<Button
				variant="secondary"
				disabled={!playground || isLoading}
				isBusy={isLoading}
				onClick={handleOpenPhpMyAdmin}
				icon={external}
				iconPosition="right"
				iconSize={16}
			>
				Open phpMyAdmin
			</Button>
			{error && (
				<div className={css.error}>
					Unable to open phpMyAdmin. Please try again. Error: {error}
				</div>
			)}
		</>
	);
}
