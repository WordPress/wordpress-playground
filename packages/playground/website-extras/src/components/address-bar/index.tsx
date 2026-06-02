import React, { useCallback } from 'react';
import css from './style.module.css';

interface AddressBarProps {
	url?: string;
	onUpdate?: (url: string) => void;
}
export default function AddressBar({ url, onUpdate }: AddressBarProps) {
	const input = React.useRef<HTMLInputElement>(null);
	const [value, setValue] = React.useState(url || '');
	const [isFocused, setIsFocused] = React.useState(false);

	React.useEffect(() => {
		if (!isFocused && url) {
			setValue(url);
		}
	}, [isFocused, url]);

	const handleSubmit = useCallback(
		function (e: React.FormEvent<HTMLFormElement>) {
			e.preventDefault();
			const requestedPath = input.current!.value;
			onUpdate?.(requestedPath);
			input.current!.blur();
		},
		[onUpdate]
	);

	const handleRefresh = useCallback(
		function (e: React.MouseEvent<HTMLButtonElement>) {
			e.preventDefault();
			if (url) {
				onUpdate?.(url);
			}
		},
		[url, onUpdate]
	);

	return (
		<form className={css.form} onSubmit={handleSubmit}>
			<button
				type="button"
				className={css.refreshButton}
				onClick={handleRefresh}
				aria-label="Refresh page"
				title="Refresh page"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M13.65 2.35C12.2 0.9 10.21 0 8 0 3.58 0 0.01 3.58 0.01 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L9 7h7V0l-2.35 2.35z"
						fill="currentColor"
					/>
				</svg>
			</button>
			<div className={css.inputContainer}>
				<input
					ref={input}
					className={css.input}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					name="url"
					type="text"
					aria-label='URL to visit in the WordPress site, like"/wp-admin"'
					autoComplete="off"
				/>
			</div>
			<input className={css.submit} type="submit" tabIndex={-1} />
		</form>
	);
}
