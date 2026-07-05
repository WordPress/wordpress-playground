import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent, FocusEvent } from 'react';
import { logger } from '@php-wasm/logger';
import type { SiteInfo } from '../state/redux/slice-sites';
import { useSitesAPI } from '../state/redux/site-management-api-middleware';

/**
 * Inline Playground renaming, shared by every surface that used to open the
 * rename modal (the Playgrounds list, the dock's "Site details" header, the
 * site-manager panel). Editing happens in place: Enter or blur commits, Escape
 * cancels. `getInputProps(site)` returns the props for the editing field;
 * `isEditing(slug)` tells a row/header whether to show it.
 */
export function useInlineRename() {
	const sitesAPI = useSitesAPI();
	const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
	const [value, setValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);
	// Rename saves are async. If the user starts editing the same row again
	// before an earlier save finishes, that old save must not close the new
	// input when its finally block runs.
	const editingSessionRef = useRef(0);
	const committingSessionRef = useRef<number | null>(null);
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
		editingSessionRef.current += 1;
		committingSessionRef.current = null;
		skipNextBlurRef.current = false;
		setValue(site.metadata.name ?? '');
		setRenamingSlug(site.slug);
	};

	const commit = async (site: SiteInfo) => {
		const committedSession = editingSessionRef.current;
		if (committingSessionRef.current === committedSession) {
			return;
		}
		committingSessionRef.current = committedSession;
		skipNextBlurRef.current = true;
		const committedSlug = site.slug;
		const trimmed = value.trim();
		if (!trimmed || trimmed === site.metadata.name) {
			if (committingSessionRef.current === committedSession) {
				committingSessionRef.current = null;
			}
			if (editingSessionRef.current === committedSession) {
				setRenamingSlug((slug) =>
					slug === committedSlug ? null : slug
				);
			}
			return;
		}
		try {
			await sitesAPI.rename(trimmed, site.slug);
		} catch (error) {
			logger.error('Renaming the Playground failed.', error);
			alert('Unable to rename this Playground. Please try again.');
		} finally {
			if (committingSessionRef.current === committedSession) {
				committingSessionRef.current = null;
			}
			if (editingSessionRef.current === committedSession) {
				setRenamingSlug((slug) =>
					slug === committedSlug ? null : slug
				);
			}
		}
	};

	const cancel = () => {
		editingSessionRef.current += 1;
		committingSessionRef.current = null;
		skipNextBlurRef.current = true;
		setRenamingSlug(null);
	};

	const isEditing = (slug: string) => renamingSlug === slug;

	const getInputProps = (site: SiteInfo) => ({
		ref: inputRef,
		value,
		maxLength: 80,
		name: 'playground-name',
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
