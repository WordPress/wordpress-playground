import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon, Popover } from '@wordpress/components';
import { home, wordpress, layout, pin } from '@wordpress/icons';
import classNames from 'classnames';
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
	/**
	 * Renders the bar inert (e.g. while the Playground is still booting and
	 * there is no client to navigate yet) instead of hiding it, so the Dock
	 * layout stays stable through loading.
	 */
	disabled?: boolean;
}

export default function AddressBar({
	url,
	onUpdate,
	disabled = false,
}: AddressBarProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [value, setValue] = useState(url || '');
	const [isFocused, setIsFocused] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	// -1 means no option is active; focus stays on the input and the active
	// option is exposed via aria-activedescendant (WAI-ARIA combobox pattern).
	const [activeIndex, setActiveIndex] = useState(-1);
	const [menuWidth, setMenuWidth] = useState(0);

	const idPrefix = useId();
	const listboxId = `${idPrefix}-suggestions`;
	const optionId = (index: number) => `${idPrefix}-suggestion-${index}`;

	useEffect(() => {
		if (!isFocused) {
			setValue(url ?? '');
		}
	}, [isFocused, url]);

	useEffect(() => {
		if (disabled) {
			setIsOpen(false);
			setActiveIndex(-1);
			setIsFocused(false);
			setValue(url ?? '');
		}
	}, [disabled, url]);

	// Update listbox width when it opens and track resize.
	useEffect(() => {
		if (!isOpen || !inputRef.current) {
			return;
		}
		setMenuWidth(inputRef.current.offsetWidth);
		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setMenuWidth(entry.contentRect.width);
			}
		});
		resizeObserver.observe(inputRef.current);
		return () => resizeObserver.disconnect();
	}, [isOpen]);

	function closeSuggestions() {
		setIsOpen(false);
		setActiveIndex(-1);
	}

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const requestedPath = inputRef.current!.value;
		onUpdate?.(requestedPath);
		inputRef.current!.blur();
		closeSuggestions();
	}

	function handleRefresh(e: React.MouseEvent<HTMLButtonElement>) {
		e.preventDefault();
		if (url) {
			onUpdate?.(url);
		}
	}

	function handleNavigation(path: string) {
		onUpdate?.(path);
		closeSuggestions();
		inputRef.current?.blur();
	}

	function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		// Combobox keyboard model: focus stays on the input; arrow keys move the
		// active option (Down lands on the first, Up wraps to the last), Enter
		// chooses the active option (or, if none, submits the typed path).
		const count = quickNavItems.length;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (disabled) {
				return;
			}
			setIsOpen(true);
			setActiveIndex((index) => (index + 1) % count);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (disabled) {
				return;
			}
			setIsOpen(true);
			setActiveIndex((index) => (index <= 0 ? count - 1 : index - 1));
		} else if (e.key === 'Enter') {
			if (isOpen && activeIndex >= 0) {
				e.preventDefault();
				handleNavigation(quickNavItems[activeIndex].path);
			}
		} else if (e.key === 'Escape') {
			closeSuggestions();
		}
	}

	function handleFocus() {
		if (disabled) {
			return;
		}
		setIsFocused(true);
		setIsOpen(true);
	}

	function handleBlur() {
		setIsFocused(false);
		// Close once focus leaves the whole control. Options are chosen via a
		// mousedown that keeps focus on the input, so leaving the input means
		// leaving the control.
		setTimeout(() => {
			if (!containerRef.current?.contains(document.activeElement)) {
				closeSuggestions();
			}
		}, 0);
	}

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		setValue(e.target.value);
		setActiveIndex(-1);
	}

	return (
		<form className={css.form} onSubmit={handleSubmit}>
			<button
				type="button"
				className={css.refreshButton}
				onClick={handleRefresh}
				disabled={disabled}
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
					onKeyDown={handleInputKeyDown}
					disabled={disabled}
					name="url"
					type="text"
					aria-label='URL to visit in the WordPress site, like "/wp-admin"'
					autoComplete="off"
					role="combobox"
					aria-autocomplete="list"
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					aria-controls={isOpen ? listboxId : undefined}
					aria-activedescendant={
						isOpen && activeIndex >= 0
							? optionId(activeIndex)
							: undefined
					}
				/>
				{isOpen && (
					<Popover
						placement="top-start"
						onClose={closeSuggestions}
						anchor={inputRef.current}
						noArrow={true}
						focusOnMount={false}
						className={css.popover}
					>
						<ul
							id={listboxId}
							role="listbox"
							className={css.suggestions}
							style={{ width: menuWidth }}
						>
							{quickNavItems.map((item, index) => (
								<li
									key={item.path}
									id={optionId(index)}
									role="option"
									aria-selected={index === activeIndex}
									className={classNames(css.suggestionItem, {
										[css.suggestionItemActive]:
											index === activeIndex,
									})}
									// Keep focus in the combobox until click activates
									// the option. Assistive technology also synthesizes
									// click without a preceding mouse event.
									onMouseDown={(event) => {
										event.preventDefault();
									}}
									onClick={() => handleNavigation(item.path)}
									onMouseEnter={() => setActiveIndex(index)}
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
						</ul>
					</Popover>
				)}
			</div>
			{/* Off-screen submit so Enter in the input navigates. Hidden from AT
			    and given an explicit value so it never surfaces the browser's
			    localized default ("Submit"/"Prześlij"). */}
			<input
				className={css.submit}
				type="submit"
				value="Go"
				tabIndex={-1}
				aria-hidden="true"
			/>
		</form>
	);
}
