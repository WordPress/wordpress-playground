import type { FormEvent } from 'react';
import { useRef, useState } from 'react';
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
				<p>
					On the host device, open Site Tools and start remote access.
					Then enter the code shown there.
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
