import type { PlaygroundClient } from '@wp-playground/client';

import css from './style.module.css';
import Button from '../button';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Modal, { defaultStyles } from '../modal';
import { playgroundAvailableInOpfs } from './playground-available-in-opfs';
import { PlaygroundConfiguration, PlaygroundConfigurationForm } from './form';
import { reloadWithNewConfiguration } from './reload-with-new-configuration';
import {
	getIndexedDB,
	loadDirectoryHandle,
	saveDirectoryHandle,
} from './idb-opfs';
import { OPFSButton } from './opfs-button';
import { usePlaygroundContext } from '../playground-viewport/context';
import { SyncLocalFilesButton } from './sync-local-files-button';
import { StartOverButton } from './start-over-button';

interface SiteSetupGroupProps {
	initialConfiguration: PlaygroundConfiguration;
}

const canUseLocalDirectory = !!(window as any).showDirectoryPicker;

let idb: IDBDatabase | null,
	lastDirectoryHandle: FileSystemDirectoryHandle | null;
try {
	idb = await getIndexedDB();
	lastDirectoryHandle = await loadDirectoryHandle(idb);
} catch (e) {
	// Ignore errors.
}

interface MessageEnvelope {
	type: 'request';
	data: RequestMessage;
}
interface RequestMessage {
	url: string;
	method: string;
	headers: string[];
	data: string;
}

export default function PlaygroundConfigurationGroup({
	initialConfiguration,
}: SiteSetupGroupProps) {
	const [isOpen, setOpen] = useState(false);
	const openModal = () => setOpen(true);
	const closeModal = () => setOpen(false);
	const playgroundRef = useRef<{
		promise: Promise<PlaygroundClient>;
		resolve: any;
	}>();
	const { playground } = usePlaygroundContext();
	useEffect(() => {
		if (!playgroundRef.current) {
			let resolve;
			const promise = new Promise<PlaygroundClient>((_resolve) => {
				resolve = _resolve;
			});
			playgroundRef.current = {
				promise,
				resolve,
			};
		}
		if (playground) {
			playgroundRef.current!.resolve(playground);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!playground]);

	const [wpVersionChoices, setWPVersionChoices] = useState<
		Record<string, string>
	>({});
	useEffect(() => {
		playground?.onMessage(async (message: string) => {
			const envelope: MessageEnvelope = JSON.parse(message);
			const { type, data } = envelope;
			if (type !== 'request') {
				return '';
			}

			try {
				const hostname = new URL(data.url).hostname;
				const fetchUrl = [
					'api.wordpress.org',
					'w.org',
					's.w.org',
				].includes(hostname)
					? `/plugin-proxy.php?url=${encodeURIComponent(data.url)}`
					: data.url;

				const response = await fetch(fetchUrl, {
					method: data.method,
					headers: Object.fromEntries(
						data.headers.map((line) => line.split(': '))
					),
					body: data.data,
				});
				const responseHeaders: string[] = [];
				response.headers.forEach((value, key) => {
					responseHeaders.push(key + ': ' + value);
				});

				const headersText =
					[
						'HTTP/1.1 ' +
							response.status +
							' ' +
							response.statusText,
						...responseHeaders,
					] + `\r\n\r\n`;
				const headersBuffer = new TextEncoder().encode(headersText);
				const bodyBuffer = new Uint8Array(await response.arrayBuffer());
				const jointBuffer = new Uint8Array(
					headersBuffer.byteLength + bodyBuffer.byteLength
				);
				jointBuffer.set(headersBuffer);
				jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

				return jointBuffer;
			} catch (e) {
				console.error(e);
				return '';
			}
		});
		playground?.getSupportedWordPressVersions().then(({ all, latest }) => {
			const formOptions: Record<string, string> = {};
			for (const version of Object.keys(all)) {
				if (version === 'beta') {
					// Don't show beta versions related to supported major releases
					if (!(all.beta.substring(0, 3) in all)) {
						formOptions[version] = all.beta;
					}
				} else {
					formOptions[version] = version;
				}
			}
			setWPVersionChoices(formOptions);
			if (currentConfiguration.wp === 'latest') {
				setCurrentConfiguration({
					...currentConfiguration,
					wp: latest,
				});
			}
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [!!playground]);

	const [isResumeLastDirOpen, setResumeLastDirOpen] = useState(
		(initialConfiguration.storage === 'opfs-host' ||
			initialConfiguration.storage === 'device') &&
			!!lastDirectoryHandle
	);
	const closeResumeLastDirModal = () => setResumeLastDirOpen(false);

	const [dirName, setDirName] = useState<string | undefined>(
		lastDirectoryHandle?.name
	);
	const [mounting, setMounting] = useState(false);
	const [mountProgress, setMountProgress] = useState<any | null>(null);

	const [currentConfiguration, setCurrentConfiguration] =
		useState(initialConfiguration);

	const isSameOriginAsPlayground = useIsSameOriginAsPlayground(playground);

	async function handleSelectLocalDirectory() {
		let dirHandle: FileSystemDirectoryHandle;
		try {
			// Request permission to access the directory.
			// https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
			dirHandle = await (window as any).showDirectoryPicker({
				// By specifying an ID, the browser can remember different directories for
				// different IDs.If the same ID is used for another picker, the picker opens
				// in the same directory.
				id: 'playground-directory',
				mode: 'readwrite',
			});
		} catch (e) {
			// No directory selected but log the error just in case.
			console.error(e);
			return;
		}
		setDirName(dirHandle.name);
		await handleMountLocalDirectory(dirHandle);
		closeModal();
	}

	async function handleResumeLastDir(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const perm = await (lastDirectoryHandle as any).requestPermission({
			mode: 'readwrite',
		});
		if (perm === 'granted') {
			await handleMountLocalDirectory(lastDirectoryHandle!);
		} else {
			alert('Switching to temporary site mode.');
		}
		closeResumeLastDirModal();
	}

	async function handleMountLocalDirectory(
		dirHandle: FileSystemDirectoryHandle
	) {
		const playground = await playgroundRef.current!.promise;
		if (idb) {
			await saveDirectoryHandle(idb, dirHandle);
		}

		setMounting(true);
		try {
			const isPlaygroundDir = await playgroundAvailableInOpfs(dirHandle);
			if (!isPlaygroundDir) {
				// Check if it's an empty directory.
				for await (const _ of dirHandle.values()) {
					if (_.name.startsWith('.')) continue;
					alert(
						'You need to select either an empty directory or a pre-existing Playground directory.'
					);
					return;
				}
			}

			await playground.bindOpfs(dirHandle, (progress) => {
				setMountProgress(progress);
			});

			setCurrentConfiguration({
				...currentConfiguration,
				storage: 'device',
			});
			await playground.goTo('/');

			// Read current querystring and replace storage=browser with storage=device.
			const url = new URL(window.location.href);
			url.searchParams.set('storage', 'device');
			window.history.pushState({}, '', url.toString());

			alert('You are now using WordPress from your local directory.');
		} finally {
			setMounting(false);
		}
	}

	async function handleSubmit(config: PlaygroundConfiguration) {
		const playground = await playgroundRef.current!.promise;
		if (
			config.resetSite &&
			(config.storage === 'opfs-browser' || config.storage === 'browser')
		) {
			if (
				!window.confirm(
					'This will wipe out all stored data and start a new site. Do you want to proceed?'
				)
			) {
				return;
			}
		}

		reloadWithNewConfiguration(playground!, config);
	}
	const WPLabel =
		wpVersionChoices[currentConfiguration.wp] || currentConfiguration.wp;

	return (
		<>
			<Button onClick={openModal}>
				PHP {currentConfiguration.php} {' - '}
				WP {WPLabel} {' - '}
				{currentConfiguration.storage === 'opfs-host' ||
				currentConfiguration.storage === 'device'
					? `Storage: Device (${dirName})`
					: currentConfiguration.storage === 'opfs-browser' ||
					  currentConfiguration.storage === 'browser'
					? 'Storage: Browser'
					: '⚠️ Storage: None'}
			</Button>
			{currentConfiguration.storage === 'opfs-host' ||
			currentConfiguration.storage === 'device' ? (
				<SyncLocalFilesButton />
			) : null}
			{currentConfiguration.storage === 'opfs-browser' ||
			currentConfiguration.storage === 'browser' ? (
				<StartOverButton />
			) : null}
			{isResumeLastDirOpen ? (
				<Modal
					isOpen={isResumeLastDirOpen}
					onRequestClose={closeResumeLastDirModal}
					style={{
						...defaultStyles,
						content: {
							...defaultStyles.content,
							width: 550,
						},
					}}
				>
					<h2 style={{ textAlign: 'center', marginTop: 0 }}>
						Resume working in local directory?
					</h2>
					<p>
						It seems like you were working a local directory called{' '}
						<b>"{lastDirectoryHandle!.name}"</b> during your last
						visit. Would you like to resume working in this
						directory or start fresh?
					</p>
					<form
						onSubmit={handleResumeLastDir}
						className={css.buttonsWrapper}
					>
						<Button
							size="large"
							onClick={() => {
								reloadWithNewConfiguration(playground!, {
									...initialConfiguration,
									storage: 'none',
								});
							}}
						>
							Start a fresh site
						</Button>
						<OPFSButton
							isMounting={mounting}
							mountProgress={mountProgress}
							type="submit"
							variant="primary"
							size="large"
							autoFocus
						>
							Resume working in "{lastDirectoryHandle!.name}"
						</OPFSButton>
					</form>
				</Modal>
			) : null}
			<Modal
				isOpen={isOpen}
				onRequestClose={closeModal}
				style={{
					...defaultStyles,
					content: {
						...defaultStyles.content,
						width: 550,
					},
				}}
			>
				<PlaygroundConfigurationForm
					supportedWPVersions={wpVersionChoices}
					currentlyRunningWordPressVersion={currentConfiguration.wp}
					initialData={currentConfiguration}
					onSubmit={handleSubmit}
					isMountingLocalDirectory={mounting}
					mountProgress={mountProgress}
					onSelectLocalDirectory={
						canUseLocalDirectory
							? isSameOriginAsPlayground
								? handleSelectLocalDirectory
								: 'origin-mismatch'
							: 'not-available'
					}
				/>
			</Modal>
		</>
	);
}

function useIsSameOriginAsPlayground(playground?: PlaygroundClient) {
	const [isSameOriginAsPlayground, setIsSameOriginAsPlayground] = useState<
		null | boolean
	>(null);

	useEffect(() => {
		if (!playground) return;
		(async () => {
			setIsSameOriginAsPlayground(
				new URL(await playground.absoluteUrl).origin ===
					window.location.origin
			);
		})();
	}, [playground]);

	return isSameOriginAsPlayground;
}
