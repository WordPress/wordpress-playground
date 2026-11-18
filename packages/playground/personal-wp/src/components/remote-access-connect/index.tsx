import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { logger } from '@php-wasm/logger';
import { getModelContext } from '@wp-playground/mcp/client';
import { personalWPSiteSlug } from 'virtual:website-defaults';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import { getAppBaseUrl } from '../../lib/state/url/app-base-url';
import {
	formatAccessCode,
	normalizeAccessCode,
	resolveAccessCode,
	ResolveAccessCodeError,
} from '@wp-playground/remote-access';
import { RemoteAccessViewer } from '../remote-access-viewer';
import css from './style.module.css';

export function RemoteAccessConnect() {
	const [code, setCode] = useState('');
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [hasSavedMainSite, setHasSavedMainSite] = useState<boolean | null>(
		null
	);

	useEffect(() => {
		const controller = new AbortController();
		async function checkSavedSite(): Promise<boolean | null> {
			let hasSavedSite: boolean | null = null;
			try {
				if (opfsSiteStorage) {
					hasSavedSite = !!(await opfsSiteStorage.read(
						personalWPSiteSlug ?? 'default'
					));
				}
			} catch (error) {
				logger.warn(
					'Could not check the saved My WordPress site:',
					error
				);
			}
			if (!controller.signal.aborted) {
				setHasSavedMainSite(hasSavedSite);
			}
			return hasSavedSite;
		}
		const refreshSavedSite = () => {
			void checkSavedSite();
		};
		refreshSavedSite();
		window.addEventListener('focus', refreshSavedSite);
		async function registerStatusTool() {
			await getModelContext()?.registerTool(
				{
					name: 'my_wordpress_connection_status',
					description:
						'Check whether this browser has a saved main WordPress before ' +
						'connecting elsewhere. A saved site may differ from the user’s ' +
						'intended site. Returns true, false, or null if storage cannot ' +
						'be checked, plus built-in Remote Access instructions. This ' +
						'checks site availability, not content. No extension is required.',
					inputSchema: {
						type: 'object',
						properties: {},
						additionalProperties: false,
					},
					annotations: { readOnlyHint: true },
					execute: async () => {
						const hasSavedSite = await checkSavedSite();
						return {
							hasSavedMainSite: hasSavedSite,
							localSiteUrl: getAppBaseUrl().href,
							guidance:
								hasSavedSite === null
									? 'Could not determine whether a main site is saved in this browser. ' +
										'Offer to open localSiteUrl to check, or use Remote Access ' +
										'to connect to a site in another browser.'
									: hasSavedSite
										? 'A main site is saved in this browser. Offer to open it ' +
											'at localSiteUrl if that is the site the user wants. ' +
											'To connect to a site in another browser, ask the user to ' +
											`open ${window.location.origin} there, choose Site Tools → ` +
											'Remote Access, and provide its access code. Enter the code ' +
											'here. No browser extension is required.'
										: 'No main site is saved in this browser. Ask the user to ' +
											`open ${window.location.origin} in their usual browser, choose ` +
											'Site Tools → Remote Access, and provide its access code. ' +
											'Enter the code here. No browser extension is required.',
						};
					},
				},
				{ signal: controller.signal }
			);
		}
		void registerStatusTool().catch((error) => {
			logger.warn(
				'Could not register the connection status tool:',
				error
			);
		});
		return () => {
			controller.abort();
			window.removeEventListener('focus', refreshSavedSite);
		};
	}, []);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const normalized = normalizeAccessCode(code);
		if (!normalized) {
			setStatus('error');
			setError('Enter the six-digit code from the host device.');
			inputRef.current?.focus();
			return;
		}

		setStatus('loading');
		setError(null);
		try {
			const data = await resolveAccessCode(
				window.location.origin,
				normalized
			);
			// Keep the session in this document only. A URL must never start a connection.
			window.history.replaceState({}, '', '/connect/');
			setSessionId(data.sessionId);
		} catch (error) {
			if (
				error instanceof ResolveAccessCodeError &&
				error.response.status === 404
			) {
				setStatus('error');
				setError(
					'That code was not found. Start remote access again on the host device.'
				);
				return;
			}
			setStatus('error');
			setError('Could not connect. Check the code and try again.');
		}
	}

	if (sessionId) {
		return <RemoteAccessViewer sessionId={sessionId} />;
	}

	return (
		<main className={css.page}>
			<section className={css.panel}>
				<h1>Connect to a remote My WordPress</h1>
				{hasSavedMainSite === true && (
					<p>
						It looks like you already have My WordPress in this
						browser. <a href={getAppBaseUrl().href}>Open it here</a>
						.
					</p>
				)}
				{hasSavedMainSite === false && (
					<p>
						No WordPress is saved in this browser. Your existing
						site may be in another browser.
					</p>
				)}
				<p>
					To connect to a site in another browser, open
					{window.location.host} there and start Remote Access in Site
					Tools. Enter the code below.
				</p>
				<form className={css.form} onSubmit={submit}>
					<label htmlFor="remote-access-code">Access code</label>
					<input
						ref={inputRef}
						id="remote-access-code"
						inputMode="numeric"
						autoComplete="one-time-code"
						autoFocus={true}
						placeholder="123-456"
						value={formatAccessCode(code)}
						onChange={(event) => setCode(event.target.value)}
						disabled={status === 'loading'}
					/>
					<button type="submit" disabled={status === 'loading'}>
						{status === 'loading' ? 'Connecting...' : 'Connect'}
					</button>
				</form>
				{error && (
					<p className={css.error} role="alert">
						{error}
					</p>
				)}
			</section>
		</main>
	);
}

export function isRemoteAccessConnectRoute(): boolean {
	// The deployment serves index.html for unknown paths.
	// That SPA fallback lets /connect and /connect/... display code entry.
	return (
		window.location.pathname === '/connect' ||
		window.location.pathname.startsWith('/connect/') ||
		// Old share links lead to code entry, never directly to the viewer.
		new URLSearchParams(window.location.search).has('share')
	);
}
