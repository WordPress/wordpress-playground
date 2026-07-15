import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent, FocusEvent } from 'react';
import { logger } from '@php-wasm/logger';
import type { SiteInfo } from '../state/redux/slice-sites';
import { useSitesAPI } from '../state/redux/site-management-api-middleware';
import { useAppDispatch } from '../state/redux/store';
import { setDockOperationNotice } from '../state/redux/slice-ui';

/**
 * Inline Playground renaming for compact UI surfaces. Enter or blur commits;
 * Escape cancels. `getInputProps(site)` returns the editing field props, while
 * `isEditing(slug)` tells the caller whether to show it.
 */
export function useInlineRename() {
	const sitesAPI = useSitesAPI();
	const dispatch = useAppDispatch();
	const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
	const [value, setValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);
	// Removing the focused input fires a blur; this flag lets us ignore that
	// blur so Enter/Escape don't also trigger a second commit.
	const skipNextBlurRef = useRef(false);

	useEffect(() => {
		if (renamingSlug) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [renamingSlug]);

	const start = (site: SiteInfo) => {
		skipNextBlurRef.current = false;
		setValue(site.metadata.name ?? '');
		setRenamingSlug(site.slug);
	};

	const commit = async (site: SiteInfo) => {
		skipNextBlurRef.current = true;
		const trimmed = value.trim();
		setRenamingSlug(null);
		if (!trimmed || trimmed === site.metadata.name) {
			return;
		}
		try {
			dispatch(setDockOperationNotice(undefined));
			await sitesAPI.rename(trimmed, site.slug);
		} catch (error) {
			logger.error('Renaming the Playground failed.', error);
			skipNextBlurRef.current = false;
			setRenamingSlug(site.slug);
			dispatch(
				setDockOperationNotice({
					title: `Couldn’t rename “${site.metadata.name}”`,
					message:
						'Your new name is still in the field so you can try again.',
				})
			);
		}
	};

	const cancel = () => {
		skipNextBlurRef.current = true;
		setRenamingSlug(null);
	};

	const isEditing = (slug: string) => renamingSlug === slug;

	const getInputProps = (site: SiteInfo) => ({
		ref: inputRef,
		value,
		maxLength: 80,
		'aria-label': 'Rename Playground',
		onChange: (event: ChangeEvent<HTMLInputElement>) =>
			setValue(event.target.value),
		onClick: (event: MouseEvent<HTMLInputElement>) =>
			event.stopPropagation(),
		onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
			// Keep Enter/Space/Escape from reaching the row (navigate) or the
			// pane (close) while editing.
			event.stopPropagation();
			if (event.key === 'Enter') {
				event.preventDefault();
				void commit(site);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				cancel();
			}
		},
		onBlur: (_event: FocusEvent<HTMLInputElement>) => {
			if (skipNextBlurRef.current) {
				skipNextBlurRef.current = false;
				return;
			}
			void commit(site);
		},
	});

	return { isEditing, start, getInputProps };
}
