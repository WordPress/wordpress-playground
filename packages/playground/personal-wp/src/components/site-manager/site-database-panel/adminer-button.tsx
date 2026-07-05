import { Button, Icon, Flex, FlexItem } from '@wordpress/components';
import { external } from '@wordpress/icons';
import { useEffect, useRef, useState } from 'react';
import css from './style.module.css';
import {
	type PlaygroundClient,
	type StepDefinition,
	type UniversalPHP,
	compileBlueprintV1,
	runBlueprintV1Steps,
} from '@wp-playground/client';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
// @ts-ignore
import { corsProxyUrl } from 'virtual:cors-proxy-url';

const adminerUrl =
	'https://github.com/vrana/adminer/releases/download/v5.4.1/adminer-5.4.1-mysql-en.php';

async function installAdminer(playground: PlaygroundClient) {
	const documentRoot = await playground.documentRoot;
	const adminerPath = joinPaths(documentRoot, 'adminer');

	const steps: StepDefinition[] = [];
	if (!(await playground.isDir(adminerPath).catch(() => false))) {
		steps.push({ step: 'mkdir', path: adminerPath });
	}
	steps.push(
		{
			step: 'writeFile',
			path: joinPaths(adminerPath, 'adminer.php'),
			data: {
				resource: 'url',
				url: adminerUrl,
			},
		},
		{
			step: 'writeFile',
			path: joinPaths(adminerPath, 'adminer-mysql-on-sqlite-driver.php'),
			data: (
				await import('./adminer-extensions/adminer-mysql-on-sqlite-driver.php?raw')
			).default as string,
		},
		{
			step: 'writeFile',
			path: joinPaths(adminerPath, 'index.php'),
			data: (await import('./adminer-extensions/index.php?raw'))
				.default as string,
		}
	);

	const blueprint = await compileBlueprintV1(
		{ steps },
		{ corsProxy: corsProxyUrl }
	);

	await runBlueprintV1Steps(blueprint, playground as UniversalPHP);
}

export function AdminerButton({
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

		async function detectAdminer() {
			try {
				const documentRoot = await currentPlayground.documentRoot;
				const adminerPath = joinPaths(documentRoot, 'adminer');
				const isReady =
					(await currentPlayground.fileExists(
						joinPaths(adminerPath, 'index.php')
					)) &&
					(await currentPlayground.fileExists(
						joinPaths(adminerPath, 'adminer.php')
					)) &&
					(await currentPlayground.fileExists(
						joinPaths(
							adminerPath,
							'adminer-mysql-on-sqlite-driver.php'
						)
					));
				if (cancelled) return;
				readyPlaygroundRef.current = isReady ? currentPlayground : null;
				setState(isReady ? 'ready' : 'idle');
			} catch (error) {
				logger.error('Could not detect Adminer installation', error);
				if (!cancelled) {
					readyPlaygroundRef.current = null;
					setState('idle');
				}
			}
		}

		void detectAdminer();
		return () => {
			cancelled = true;
		};
	}, [playground]);

	const handleOpenAdminer = async () => {
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
				'The browser blocked the Adminer popup. Please allow popups and try again.'
			);
			return;
		}
		targetWindow.opener = null;

		if (!isReadyForCurrentPlayground) {
			setState('loading');
			try {
				await installAdminer(playground);
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
				logger.error('Could not install Adminer', error);
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
			logger.error('Could not open Adminer', error);
			setError(error instanceof Error ? error.message : 'Unknown error');
			return;
		}
		if (playgroundUrl) {
			const adminerUrl = `${playgroundUrl}/adminer/`;
			targetWindow.location.href = adminerUrl;
		} else {
			targetWindow.close();
			setError('Could not determine the Playground URL.');
		}
	};

	const isLoading = state === 'loading';
	return (
		<>
			<Flex direction="column" gap={0} expanded={false}>
				<Button
					variant="primary"
					disabled={!playground || isLoading}
					isBusy={isLoading}
					onClick={handleOpenAdminer}
				>
					<Flex justify="space-between" gap={2} expanded={true}>
						<FlexItem>Open Adminer</FlexItem>
						<FlexItem>
							<Icon icon={external} size={16} />
						</FlexItem>
					</Flex>
				</Button>
			</Flex>
			{error && (
				<div className={css.error}>
					Unable to open Adminer. Please try again. Error: {error}
				</div>
			)}
		</>
	);
}
