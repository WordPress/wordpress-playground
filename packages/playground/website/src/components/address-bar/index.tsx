import React, {
	useCallback,
	useState,
	useRef,
	useEffect,
	useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@wordpress/components';
import { home, wordpress, layout, pin } from '@wordpress/icons';
import css from './style.module.css';

/**
 * Custom SVG icons matching WordPress admin dashicons exactly.
 * Source: https://github.com/WordPress/dashicons/tree/master/svg-min
 */
const DashiconPlugins = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M13.11 4.36L9.87 7.6 8 5.73l3.24-3.24c.35-.34 1.05-.2 1.56.32.52.51.66 1.21.31 1.55zm-8 1.77l.91-1.12 9.01 9.01-1.19.84c-.71.71-2.63 1.16-3.82 1.16H6.14L4.9 17.26c-.59.59-1.54.59-2.12 0-.59-.58-.59-1.53 0-2.12l1.24-1.24v-3.88c0-1.13.4-3.19 1.09-3.89zm7.26 3.97l3.24-3.24c.34-.35 1.04-.21 1.55.31.52.51.66 1.21.31 1.55l-3.24 3.25z" />
	</svg>
);

const DashiconAppearance = () => (
	<svg
		width="20"
		height="20"
		viewBox="0 0 20 20"
		fill="currentColor"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path d="M14.48 11.06L7.41 3.99l1.5-1.5c.5-.56 2.3-.47 3.51.32 1.21.8 1.43 1.28 2.91 2.1 1.18.64 2.45 1.26 4.45.85zm-.71.71L6.7 4.7 4.93 6.47c-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39.39 1.03 0 1.42-.6.6-1.43 1.11-2.21 1.69-.35.26-.7.53-1.01.84C1.43 14.23.4 16.08 1.4 17.07c.99 1 2.84-.03 4.18-1.36.31-.31.58-.66.85-1.02.57-.78 1.08-1.61 1.69-2.21.39-.39 1.02-.39 1.41 0l1.06 1.06c.39.39 1.02.39 1.41 0z" />
	</svg>
);

interface QuickNavItem {
	label: string;
	path: string;
	icon: JSX.Element;
}

const quickNavItems: QuickNavItem[] = [
	{ label: 'Homepage', path: '/', icon: <Icon icon={home} size={20} /> },
	{
		label: 'Dashboard',
		path: '/wp-admin/',
		icon: <Icon icon={wordpress} size={20} />,
	},
	{
		label: 'Site Editor',
		path: '/wp-admin/site-editor.php',
		icon: <Icon icon={layout} size={20} />,
	},
	{
		label: 'New Post',
		path: '/wp-admin/post-new.php',
		icon: <Icon icon={pin} size={20} />,
	},
	{
		label: 'Plugins',
		path: '/wp-admin/plugins.php',
		icon: <DashiconPlugins />,
	},
	{
		label: 'Themes',
		path: '/wp-admin/themes.php',
		icon: <DashiconAppearance />,
	},
];

interface AddressBarProps {
	url?: string;
	onUpdate?: (url: string) => void;
}

export default function AddressBar({ url, onUpdate }: AddressBarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [value, setValue] = useState(url || '');
	const [isFocused, setIsFocused] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [dropdownPosition, setDropdownPosition] = useState({
		top: 0,
		left: 0,
		width: 0,
	});

	useEffect(() => {
		if (!isFocused && url) {
			setValue(url);
		}
	}, [isFocused, url]);

	// Update dropdown position when open
	useLayoutEffect(() => {
		if (isOpen && inputRef.current) {
			const rect = inputRef.current.getBoundingClientRect();
			setDropdownPosition({
				top: rect.bottom + 4,
				left: rect.left,
				width: rect.width,
			});
		}
	}, [isOpen]);

	// Close dropdown when clicking outside
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			const target = e.target as Node;
			if (
				containerRef.current &&
				!containerRef.current.contains(target) &&
				!(target as Element).closest?.('#address-bar-suggestions')
			) {
				setIsOpen(false);
				setSelectedIndex(-1);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const handleSubmit = useCallback(
		function (e: React.FormEvent<HTMLFormElement>) {
			e.preventDefault();
			if (selectedIndex >= 0) {
				onUpdate?.(quickNavItems[selectedIndex].path);
				setIsOpen(false);
				setSelectedIndex(-1);
			} else {
				const requestedPath = inputRef.current!.value;
				onUpdate?.(requestedPath);
			}
			inputRef.current!.blur();
		},
		[onUpdate, selectedIndex]
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

	const handleNavigation = useCallback(
		(path: string) => {
			onUpdate?.(path);
			setIsOpen(false);
			setSelectedIndex(-1);
			inputRef.current?.blur();
		},
		[onUpdate]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (!isOpen) {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					setIsOpen(true);
					setSelectedIndex(0);
				}
				return;
			}

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev < quickNavItems.length - 1 ? prev + 1 : prev
					);
					break;
				case 'ArrowUp':
					e.preventDefault();
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
					if (selectedIndex === 0) {
						setIsOpen(false);
					}
					break;
				case 'Escape':
					e.preventDefault();
					setIsOpen(false);
					setSelectedIndex(-1);
					break;
				case 'Enter':
					if (selectedIndex >= 0) {
						e.preventDefault();
						handleNavigation(quickNavItems[selectedIndex].path);
					}
					break;
			}
		},
		[isOpen, selectedIndex, handleNavigation]
	);

	const handleFocus = useCallback(() => {
		setIsFocused(true);
		setIsOpen(true);
		setSelectedIndex(-1);
	}, []);

	const handleBlur = useCallback(() => {
		setIsFocused(false);
		// Small delay to allow click events on dropdown items to fire
		setTimeout(() => {
			if (!document.activeElement?.closest('#address-bar-suggestions')) {
				setIsOpen(false);
				setSelectedIndex(-1);
			}
		}, 150);
	}, []);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setValue(e.target.value);
			setSelectedIndex(-1);
		},
		[]
	);

	const dropdown = isOpen
		? createPortal(
				<ul
					id="address-bar-suggestions"
					className={css.suggestions}
					role="listbox"
					style={{
						top: dropdownPosition.top,
						left: dropdownPosition.left,
						width: dropdownPosition.width,
					}}
				>
					{quickNavItems.map((item, index) => (
						<li
							key={item.path}
							id={`suggestion-${index}`}
							role="option"
							aria-selected={index === selectedIndex}
							className={`${css.suggestionItem} ${index === selectedIndex ? css.suggestionItemSelected : ''}`}
							onMouseDown={(e) => {
								e.preventDefault();
								handleNavigation(item.path);
							}}
							onMouseEnter={() => setSelectedIndex(index)}
						>
							<span className={css.suggestionIcon}>
								{item.icon}
							</span>
							<span className={css.suggestionLabel}>
								{item.label}
							</span>
							<span className={css.suggestionPath}>
								{item.path}
							</span>
						</li>
					))}
				</ul>,
				document.body
			)
		: null;

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
			<div className={css.inputContainer} ref={containerRef}>
				<input
					ref={inputRef}
					className={css.input}
					value={value}
					onChange={handleChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					name="url"
					type="text"
					aria-label='URL to visit in the WordPress site, like "/wp-admin"'
					aria-expanded={isOpen}
					aria-haspopup="listbox"
					aria-controls="address-bar-suggestions"
					aria-activedescendant={
						selectedIndex >= 0
							? `suggestion-${selectedIndex}`
							: undefined
					}
					autoComplete="off"
				/>
			</div>
			{dropdown}
			<input className={css.submit} type="submit" tabIndex={-1} />
		</form>
	);
}
