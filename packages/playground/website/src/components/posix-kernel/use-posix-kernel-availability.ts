import type { PlaygroundClient } from '@wp-playground/client';
import { useState, useEffect } from 'react';

/**
 * Reports whether the current Playground runs on the kandelo posix-kernel.
 *
 * The kernel worker endpoint exposes an `isPosixKernel()` marker method the
 * classic endpoints do not declare, so a missing method means "classic".
 * Probing the live client keeps the answer truthful when the kernel dev
 * server serves the kernel without `?experimental=kandelo`, and when the
 * non-isolated fallback serves classic despite it.
 */
export function usePosixKernelAvailability(playground?: PlaygroundClient) {
	const [isAvailable, setIsAvailable] = useState(false);

	useEffect(() => {
		const probe = playground as unknown as {
			isPosixKernel?: () => Promise<boolean>;
		};
		if (typeof probe?.isPosixKernel !== 'function') {
			setIsAvailable(false);
			return;
		}

		let cancelled = false;
		probe.isPosixKernel().then(
			(isPosixKernel) => {
				if (!cancelled) {
					setIsAvailable(isPosixKernel === true);
				}
			},
			() => {
				if (!cancelled) {
					setIsAvailable(false);
				}
			}
		);
		return () => {
			cancelled = true;
		};
	}, [playground]);

	return isAvailable;
}
