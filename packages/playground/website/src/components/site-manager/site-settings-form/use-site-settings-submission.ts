import { useCallback, useRef, useState } from 'react';
import type { SiteFormData } from './unconnected-site-settings-form';

/**
 * Serializes settings submissions and keeps failures on the form that caused
 * them. A ref closes the same-render double-click window before React can paint
 * the disabled state.
 */
export function useSiteSettingsSubmission(onSubmit?: () => void) {
	const pendingRef = useRef(false);
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string>();

	const run = useCallback(
		async (
			action: (data: SiteFormData) => Promise<void>,
			data: SiteFormData
		) => {
			if (pendingRef.current) {
				return;
			}
			pendingRef.current = true;
			setIsPending(true);
			setError(undefined);
			try {
				onSubmit?.();
				try {
					await action(data);
				} catch (cause) {
					setError(
						cause instanceof Error
							? cause.message
							: 'Could not update Playground settings. Please try again.'
					);
					return;
				}
			} finally {
				pendingRef.current = false;
				setIsPending(false);
			}
		},
		[onSubmit]
	);

	return { error, isPending, run };
}

export type SiteSettingsSubmission = ReturnType<
	typeof useSiteSettingsSubmission
>;
