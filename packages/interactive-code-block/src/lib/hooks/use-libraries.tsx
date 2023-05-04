import * as React from 'react';
import { useState, useEffect } from '@wordpress/element';
import { cloneResponseMonitorProgress } from '@php-wasm/progress';
import type { Library } from '../types';

type LibraryCache = Record<
	Library['id'],
	{
		progress: number;
		name: string;
		contents?: Uint8Array;
	}
>;

class LibraryLoader extends EventTarget {
	private cache: LibraryCache = {};

	private async loadLibrary(library: Library) {
		// Loading is already in progress
		if (this.cache[library.id]) {
			return;
		}
		this.cache[library.id] = {
			progress: 0,
			name: library.name,
		};
		const reportingResponse = cloneResponseMonitorProgress(
			await fetch(library.url),
			(e) => {
				const { loaded, total } = e.detail;
				this.setLibraryProgress(library.id, loaded / total);
			}
		);
		const blob = await reportingResponse.blob();
		this.cache[library.id].contents = new Uint8Array(
			await blob.arrayBuffer()
		);
		this.dispatchEvent(
			new CustomEvent('load', {
				detail: {
					libraryId: library.id,
				},
			})
		);
	}

	private setLibraryProgress(libraryId: string, progress: number) {
		this.cache[libraryId].progress = progress;
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					libraryId,
					progress,
				},
			})
		);
	}

	getLoadingProgress(libraryIds: string | string[]) {
		if (!Array.isArray(libraryIds)) {
			libraryIds = [libraryIds];
		}

		if (libraryIds.length === 0) {
			return undefined;
		}

		return (
			(100 *
				libraryIds.reduce(
					(total, id) => total + this.cache[id]?.progress || 0,
					0
				)) /
			libraryIds.length
		);
	}

	isLoaded(libraryIds: string | string[]) {
		if (!Array.isArray(libraryIds)) {
			libraryIds = [libraryIds];
		}

		return libraryIds.every((id) => this.cache[id]?.contents);
	}

	getLibraryContents(libraryId: string): Uint8Array | undefined {
		return this.cache[libraryId]?.contents;
	}

	getLibrariesContents(libraryIds: string[]): Record<string, Uint8Array> {
		return Object.fromEntries(
			libraryIds
				.map((id) => [this.cache[id].name, this.getLibraryContents(id)])
				.filter(([, contents]) => contents)
		);
	}

	async load(libraries: Library[]) {
		libraries.forEach((library) => this.loadLibrary(library));
	}
}

const loader = new LibraryLoader();
export interface UseLibrariesResult {
	status: 'ready' | 'loading';
	progress?: number;
	loaded: Record<string, Uint8Array>;
}

export function useLibraries(libraries: Library[]): UseLibrariesResult {
	const ids = libraries.map(({ id }) => id);
	const isLoaded = loader.isLoaded(ids);
	const [loadedLibraries, setLoadedLibraries] = useState<
		Record<string, Uint8Array>
	>(() => (isLoaded ? loader.getLibrariesContents(ids) : {}));

	// Load libraries
	useEffect(() => {
		if (loader.isLoaded(ids)) {
			setLoadedLibraries(loader.getLibrariesContents(ids));
			return;
		}

		loader.load(libraries);

		function onLoad() {
			if (loader.isLoaded(ids)) {
				setLoadedLibraries(loader.getLibrariesContents(ids));
			}
		}

		loader.addEventListener('load', onLoad);
		return () => {
			loader.removeEventListener('load', onLoad);
		};
	}, [libraries]);

	return {
		status: isLoaded ? 'ready' : 'loading',
		progress: loader.getLoadingProgress(ids),
		loaded: loadedLibraries,
	};
}
