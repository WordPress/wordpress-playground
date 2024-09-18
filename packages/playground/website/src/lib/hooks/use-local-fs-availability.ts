import { PlaygroundClient } from '@wp-playground/client';
import { useState, useEffect } from 'react';

export type LocalFsAvailability =
	| 'available'
	| 'not-available'
	| 'origin-mismatch';

async function determineLocalFsAvailability(
	playground: PlaygroundClient
): Promise<LocalFsAvailability> {
	if (!(window as any).showDirectoryPicker) {
		return 'not-available';
	}
	const isSameOriginAsPlayground =
		new URL(await playground.absoluteUrl).origin === window.location.origin;

	if (!isSameOriginAsPlayground) {
		return 'origin-mismatch';
	}

	return 'available';
}

export function useLocalFsAvailability(playground?: PlaygroundClient) {
	const [isAvailable, setIsAvailable] = useState<LocalFsAvailability | null>(
		null
	);

	useEffect(() => {
		async function check() {
			if (!playground) {
				return;
			}
			setIsAvailable(await determineLocalFsAvailability(playground));
		}
		check();
	}, [playground]);

	return isAvailable;
}
