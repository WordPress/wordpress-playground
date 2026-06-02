import { useCallback, useEffect, useState } from 'react';
import type { EventedFilesystem } from '@wp-playground/storage';
import { encodeStringAsBase64 } from '../base64';
import { useDebouncedCallback } from './use-debounced-callback';

export interface UseBlueprintUrlHashResult {
	/**
	 * The URL hash for the current blueprint, or null if the bundle
	 * contains multiple files and can't be shared via URL.
	 */
	urlHash: string | null;

	/**
	 * Whether the bundle can be shared via URL (only contains blueprint.json).
	 */
	isShareable: boolean;
}

export interface UseBlueprintUrlHashOptions {
	/** Whether to skip URL hash computation (e.g., for read-only mode) */
	disabled?: boolean;
	/** Debounce delay in ms (default: 500) */
	debounceMs?: number;
}

/**
 * Hook that computes a shareable URL hash for a blueprint bundle.
 *
 * Returns the base64-encoded blueprint content if the bundle only contains
 * blueprint.json, or null if the bundle has additional files.
 *
 * @param filesystem - The filesystem containing the blueprint bundle
 * @param blueprintContent - The current content of blueprint.json
 * @param options - Configuration options
 */
export function useBlueprintUrlHash(
	filesystem: EventedFilesystem | null,
	blueprintContent: string,
	options: UseBlueprintUrlHashOptions = {}
): UseBlueprintUrlHashResult {
	const { disabled = false, debounceMs = 500 } = options;

	const [isShareable, setIsShareable] = useState(true);
	const [urlHash, setUrlHash] = useState<string | null>(null);

	// Check if the bundle only contains blueprint.json (can be shared via URL).
	// Blueprint bundles with additional files cannot be encoded in a URL hash.
	const checkBundleShareability = useCallback(async () => {
		if (!filesystem) {
			setIsShareable(false);
			return false;
		}
		try {
			const rootEntries = await filesystem.listFiles('/');
			const shareable =
				rootEntries.length === 1 && rootEntries[0] === 'blueprint.json';
			setIsShareable(shareable);
			return shareable;
		} catch {
			setIsShareable(false);
			return false;
		}
	}, [filesystem]);

	// Check shareability on initial load and whenever the filesystem changes
	useEffect(() => {
		if (!filesystem) {
			return;
		}

		checkBundleShareability();

		const handleFilesystemChange = () => {
			checkBundleShareability();
		};
		filesystem.addEventListener('change', handleFilesystemChange);
		return () => {
			filesystem.removeEventListener('change', handleFilesystemChange);
		};
	}, [filesystem, checkBundleShareability]);

	// Compute the URL hash when blueprint content changes.
	// Debounced to avoid excessive encoding on rapid typing.
	const computeUrlHash = useDebouncedCallback(
		(content: string, shareable: boolean) => {
			if (disabled || !shareable) {
				setUrlHash(null);
				return;
			}

			try {
				// Validate that it's valid JSON before encoding
				JSON.parse(content);
				const encoded = encodeStringAsBase64(content);
				setUrlHash(encoded);
			} catch {
				// Don't update hash if blueprint is invalid JSON
				setUrlHash(null);
			}
		},
		debounceMs,
		[]
	);

	useEffect(() => {
		if (disabled) {
			setUrlHash(null);
			return;
		}
		computeUrlHash(blueprintContent, isShareable);
	}, [blueprintContent, isShareable, disabled, computeUrlHash]);

	return { urlHash, isShareable };
}
