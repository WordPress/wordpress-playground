import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { logger } from '@php-wasm/logger';
import { getModelContext } from '@wp-playground/mcp/client';
import { personalWPSiteSlug } from 'virtual:website-defaults';
import { opfsSiteStorage } from '../../lib/state/opfs/opfs-site-storage';
import { getAppBaseUrl } from '../../lib/state/url/app-base-url';
import {
	buildRemoteAccessUrl,
	formatAccessCode,
	normalizeAccessCode,
	resolveAccessCode,
	ResolveAccessCodeError,
} from '@wp-playground/remote-access';
import css from './style.module.css';

export function RemoteAccessConnect() {
	const [code, setCode] = useState('');
	const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const [hasSavedMainSite, setHasSavedMainSite] = useState<boolean | null>(
		null
	);

	useEffect(() => {
		const controller = new AbortController();
		async function checkSavedSite() {
			if (!opfsSiteStorage) {
				return;
			}
			const sites = await opfsSiteStorage.list();
			if (controller.signal.aborted) {
				return;
			}
			const hasSavedSite = sites.some(
				(site) => site.slug === (personalWPSiteSlug ?? 'default')
			);
			setHasSavedMainSite(hasSavedSite);
			await getModelContext()?.registerTool(
				{
					name: 'my_wordpress_get_connection_status',
					description:
						'Check whether the main My WordPress site is saved in this ' +
						'browser before connecting to another browser. A saved site ' +
						'can be opened locally; if none exists here, ask the user to ' +
						'start Remote Access in the browser where their WordPress ' +
						'lives and provide the access code or link. This checks ' +
						'saved-site availability, not whether its content is empty.',
					inputSchema: {
						type: 'object',
						properties: {},
						additionalProperties: false,
					},
					annotations: { readOnlyHint: true, destructiveHint: false },
					execute: async () => ({
						hasSavedMainSite: hasSavedSite,
						localSiteUrl: getAppBaseUrl().href,
						guidance: hasSavedSite
							? 'A main site is saved in this browser. Offer to open it ' +
								'at localSiteUrl if that is the site the user wants. ' +
								'Remote Access is available for a site in another browser.'
							: 'No main site is saved in this browser. Ask the user to ' +
								'open My WordPress in their usual browser, start Remote ' +
								'Access from Site Tools, and provide the access code or link.',
					}),
				},
				{ signal: controller.signal }
			);
		}
		void checkSavedSite().catch((error) => {
			logger.warn('Could not check the saved My WordPress site:', error);
		});
		return () => controller.abort();
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
			window.location.href = buildRemoteAccessUrl(
				window.location.href,
				data.sessionId
			);
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
					my.wordpress.net there and start Remote Access in Site
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
	// my.wordpress.net is configured to serve index.html for unknown paths.
	// That SPA fallback is what lets /connect and /connect/... resume here.
	return (
		window.location.pathname === '/connect' ||
		window.location.pathname.startsWith('/connect/')
	);
}
