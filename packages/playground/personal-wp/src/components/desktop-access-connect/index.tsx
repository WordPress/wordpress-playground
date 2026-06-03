import { FormEvent, useRef, useState } from 'react';
import css from './style.module.css';

type ResolveCodeResponse = {
	sessionId: string;
	shareUrl: string;
	accessCode: string;
};

export function DesktopAccessConnect() {
	const [code, setCode] = useState('');
	const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		const normalized = normalizeCode(code);
		if (!normalized) {
			setStatus('error');
			setError('Enter the six-digit code from your phone.');
			inputRef.current?.focus();
			return;
		}

		setStatus('loading');
		setError(null);
		try {
			const response = await fetch(`/relay/code/${normalized}`);
			if (response.status === 404) {
				setStatus('error');
				setError(
					'That code was not found. Start desktop access again on your phone.'
				);
				return;
			}
			if (!response.ok) {
				throw new Error(response.statusText);
			}
			const data = (await response.json()) as ResolveCodeResponse;
			window.location.href = data.shareUrl;
		} catch {
			setStatus('error');
			setError('Could not connect. Check the code and try again.');
		}
	}

	return (
		<main className={css.page}>
			<section className={css.panel}>
				<h1>Use My WordPress on this computer</h1>
				<p>
					On your phone, open Site Tools and start desktop access.
					Then enter the code shown there.
				</p>
				<form className={css.form} onSubmit={submit}>
					<label htmlFor="desktop-access-code">Access code</label>
					<input
						ref={inputRef}
						id="desktop-access-code"
						inputMode="numeric"
						autoComplete="one-time-code"
						placeholder="123-456"
						value={formatCode(code)}
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

export function isDesktopAccessConnectRoute(): boolean {
	return window.location.pathname === '/connect';
}

function normalizeCode(value: string): string | null {
	const digits = value.replace(/\D+/g, '');
	if (digits.length !== 6) {
		return null;
	}
	return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function formatCode(value: string): string {
	const digits = value.replace(/\D+/g, '').slice(0, 6);
	if (digits.length <= 3) {
		return digits;
	}
	return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}
