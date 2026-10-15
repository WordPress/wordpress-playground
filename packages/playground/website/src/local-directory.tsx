import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { Button, Notice } from '@wordpress/components';
import './styles.css';
import css from './local-directory.module.css';
import { isSiteOrigin, rootOrigin } from './lib/origin-isolation';
import { directoryPopupUrl, directorySetupKey } from './lib/local-directory';
import {
	loadDirectoryHandle,
	saveDirectoryHandle,
} from './lib/state/opfs/opfs-directory-handle-storage';

const url = new URL(window.location.href);
const id = url.searchParams.get('request') || '';
const phase = url.searchParams.get('phase') || 'choose';
const isRoot = window.location.origin === rootOrigin();
const channel = !isRoot
	? new BroadcastChannel('playground-directory-' + id)
	: undefined;
let leavingForNextStep = false;

createRoot(document.getElementById('root')!).render(<DirectoryGuide />);

/** Only the permission window navigates. The running Playground keeps its in-memory files. */
function DirectoryGuide() {
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [name, setName] = useState('');
	const [check, setCheck] = useState<'waiting' | 'granted' | 'prompt'>(
		'waiting'
	);
	const valid =
		/^[a-f0-9-]{36}$/.test(id) &&
		(isRoot || isSiteOrigin(window.location.origin));
	const target = url.searchParams.get('site') || '';

	useEffect(() => {
		if (!valid) return;
		channel?.postMessage('ready');
		/** Closing a permission step cancels setup; deliberate step changes do not. */
		const cancelled = () => {
			if (!leavingForNextStep) channel?.postMessage('cancelled');
		};
		window.addEventListener('pagehide', cancelled);
		if (isRoot && isSiteOrigin(target)) {
			if (phase === 'renew') {
				// replace discards the picker document instead of keeping its live
				// permission grant in a back/forward history entry.
				window.location.replace(directoryPopupUrl(target, id, 'renew'));
			} else if (phase === 'verify') {
				/** Accept only the request’s check frame, never another site or popup. */
				const receive = (event: MessageEvent) => {
					const frame = document.querySelector('iframe');
					if (
						event.origin !== target ||
						event.source !== frame?.contentWindow ||
						event.data?.request !== id
					)
						return;
					if (event.data.action === 'retry') {
						window.location.replace(
							directoryPopupUrl(target, id, 'renew')
						);
						return;
					}
					if (event.data.action === 'cancel') {
						window.close();
						return;
					}
					setCheck(
						event.data.granted === true ? 'granted' : 'prompt'
					);
					if (event.data.granted === true) window.close();
				};
				window.addEventListener('message', receive);
				return () => {
					window.removeEventListener('message', receive);
					window.removeEventListener('pagehide', cancelled);
				};
			}
		} else if (!isRoot && phase === 'check' && window.parent !== window) {
			// The root can cancel or retry this permission check, but cannot obtain
			// a handle or ask it to perform any file operation. Acknowledge before
			// navigation so retry does not look like the user closed the popup.
			window.addEventListener('message', (event) => {
				if (
					event.source !== window.parent ||
					event.origin !== rootOrigin() ||
					event.data?.request !== id ||
					!['retry', 'cancel'].includes(event.data.action)
				)
					return;
				leavingForNextStep = true;
				if (event.data.action === 'cancel')
					channel?.postMessage('cancelled');
				window.parent.postMessage(
					{ request: id, action: event.data.action },
					rootOrigin()
				);
			});
			void loadDirectoryHandle(directorySetupKey(id))
				.then(async (handle) => {
					const granted =
						(await handle.queryPermission({
							mode: 'readwrite',
						})) === 'granted';
					if (granted) {
						leavingForNextStep = true;
						channel?.postMessage('complete');
					}
					window.parent.postMessage(
						{ request: id, granted },
						rootOrigin()
					);
				})
				.catch(() =>
					window.parent.postMessage(
						{ request: id, granted: false },
						rootOrigin()
					)
				);
		}
		return () => window.removeEventListener('pagehide', cancelled);
	}, []);

	/** Pick a native directory or restore its stored grant in a top-level document. */
	async function proceed() {
		setBusy(true);
		setError('');
		try {
			let handle: FileSystemDirectoryHandle;
			if (phase === 'choose' && !url.searchParams.has('site-slug')) {
				handle = await (window as any).showDirectoryPicker({
					id: 'playground-directory',
					mode: 'readwrite',
				});
				await saveDirectoryHandle(directorySetupKey(id), handle);
				setName(handle.name);
				leaveSite('renew');
			} else {
				handle = await loadDirectoryHandle(
					url.searchParams.get('site-slug') || directorySetupKey(id)
				);
				setName(handle.name);
				if (
					(await handle.queryPermission({ mode: 'readwrite' })) !==
						'granted' &&
					(await handle.requestPermission({ mode: 'readwrite' })) !==
						'granted'
				) {
					throw new Error(
						'Directory access was not approved. You can retry or cancel.'
					);
				}
				await saveDirectoryHandle(directorySetupKey(id), handle);
				leaveSite('verify');
			}
		} catch (error) {
			setError(error instanceof Error ? error.message : String(error));
			setBusy(false);
		}
	}

	/** Discard the live permission document before renewal or framed verification. */
	function leaveSite(next: string) {
		leavingForNextStep = true;
		const helper = directoryPopupUrl(rootOrigin(), id, next);
		helper.searchParams.set('site', window.location.origin);
		window.location.replace(helper);
	}

	/** Let the site frame notify the app before the root closes or retries the popup. */
	function finishCheck(action: 'retry' | 'cancel') {
		document
			.querySelector('iframe')
			?.contentWindow?.postMessage({ request: id, action }, target);
	}

	/** Cancel through the site channel without passing its handle through the root. */
	function cancel() {
		if (isRoot && phase === 'verify') {
			finishCheck('cancel');
			return;
		}
		channel?.postMessage('cancelled');
		window.close();
	}

	if (!valid || (isRoot && !isSiteOrigin(target)))
		return (
			<p>
				Invalid directory setup. Close this window and start again from
				Playground.
			</p>
		);
	if (phase === 'check') return null;
	return (
		<main className={css.guide}>
			<h1>Connect a local directory</h1>
			{isRoot ? (
				<>
					<p>
						{check === 'prompt'
							? 'Access ended when the permission step finished. Choose “Allow on every visit” to keep this directory connected after the popup closes.'
							: 'Checking that your directory stays connected after this window closes…'}
					</p>
					{phase === 'verify' && (
						<iframe
							hidden
							title="Check directory permission"
							src={directoryPopupUrl(target, id, 'check').href}
						/>
					)}
				</>
			) : (
				<>
					<p>
						Approving access makes this directory available to this
						Playground, including any plugins or code you run in it.
						Other Playgrounds do not receive its handle.
					</p>
					<p>
						Choose a separate directory for each Playground. If you
						choose the same directory for two Playgrounds, both can
						edit those files.
					</p>
					<ol>
						<li>Choose a directory and allow read/write access.</li>
						<li>
							Choose <strong>Allow on every visit</strong> in the
							next permission prompt.
						</li>
					</ol>
					<p>
						This guide does not copy your site. Keep this window
						open until setup finishes, then press Save in
						Playground.
					</p>
					{name && <p>Directory: {name}</p>}
					{error && (
						<Notice status="error" isDismissible={false}>
							{error}
						</Notice>
					)}
				</>
			)}
			<div className={css.actions}>
				{isRoot ? (
					check === 'prompt' && (
						<Button
							variant="primary"
							onClick={() => finishCheck('retry')}
						>
							Try persistent access again
						</Button>
					)
				) : (
					<Button
						variant="primary"
						disabled={busy}
						isBusy={busy}
						onClick={proceed}
					>
						{phase === 'choose' &&
						!url.searchParams.has('site-slug')
							? 'Choose directory'
							: 'Allow ongoing access'}
					</Button>
				)}
				<Button variant="tertiary" onClick={cancel}>
					Cancel
				</Button>
			</div>
		</main>
	);
}
