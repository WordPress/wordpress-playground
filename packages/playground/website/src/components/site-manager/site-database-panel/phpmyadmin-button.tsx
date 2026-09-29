import { useEffect, useState } from 'react';
import { logger } from '@php-wasm/logger';
import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
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
	PHPMYADMIN_CONFIG_PATH,
	PHPMYADMIN_ENTRY_PATH,
	PHPMYADMIN_URL_PATH,
} from '@wp-playground/tools';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

async function installPhpMyAdmin(playground: PlaygroundClient) {
	const steps = await getPhpMyAdminInstallSteps();
	const blueprint = await compileBlueprintV1(
		{ steps },
		{ corsProxy: corsProxyUrl }
	);
	await runBlueprintV1Steps(blueprint, playground as UniversalPHP);
}

export function PhpMyAdminButton({
	playground,
}: {
	playground: PlaygroundClient | undefined;
}) {
	const [state, setState] = useState<'idle' | 'loading' | 'ready'>('loading');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!playground) {
			setState('loading');
			setError(null);
			return;
		}
		setState('loading');
		let cancelled = false;

		async function detectPhpMyAdmin() {
			try {
				if (!playground) return;
				const isInstalled = await playground.isFile(
					PHPMYADMIN_CONFIG_PATH
				);
				if (cancelled) return;
				setState(isInstalled ? 'ready' : 'idle');
			} catch (error) {
				if (cancelled) return;
				logger.error('Failed to detect phpMyAdmin', error);
				setState('idle');
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

		if (state === 'idle') {
			setState('loading');
			try {
				await installPhpMyAdmin(playground);
				setState('ready');
			} catch (error) {
				setState('idle');
				setError(
					error instanceof Error ? error.message : 'Unknown error'
				);
				return;
			}
		}

		const playgroundUrl = await playground.absoluteUrl;
		if (playgroundUrl) {
			window.open(
				`${playgroundUrl}${PHPMYADMIN_URL_PATH}${PHPMYADMIN_ENTRY_PATH}`,
				'_blank',
				'noopener,noreferrer'
			);
		}
	};

	const isLoading = state === 'loading';
	return (
		<>
			<Flex direction="column" gap={0} expanded={false}>
				<Button
					variant="secondary"
					disabled={!playground || isLoading}
					isBusy={isLoading}
					onClick={handleOpenPhpMyAdmin}
				>
					<Flex justify="space-between" gap={2} expanded={true}>
						<FlexItem>Open phpMyAdmin</FlexItem>
						<FlexItem>
							<Icon icon={external} size={16} />
						</FlexItem>
					</Flex>
				</Button>
			</Flex>
			{error && (
				<div className={css.error}>
					Failed to install phpMyAdmin. Please try again. Error:{' '}
					{error}
				</div>
			)}
		</>
	);
}
