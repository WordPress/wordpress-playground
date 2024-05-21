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
			let requestedPath = input.current!.value;
			// Ensure a trailing slash when requesting directory paths
			const isDirectory = !requestedPath.split('/').pop()!.includes('.');
			if (isDirectory && !requestedPath.endsWith('/')) {
				requestedPath += '/';
			}
			onUpdate?.(requestedPath);
			input.current!.blur();
		},
		[onUpdate]
	);

	return (
		<form className={css.form} onSubmit={handleSubmit}>
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
