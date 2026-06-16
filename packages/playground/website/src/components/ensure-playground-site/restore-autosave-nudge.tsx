import { Button, Icon } from '@wordpress/components';
import { close } from '@wordpress/icons';
import css from './restore-autosave-nudge.module.css';
import { getRelativeDate } from '../../lib/get-relative-date';

/**
 * Presentational restore choice for a recent autosave matching the current
 * setup URL. Rendered inside a Popover anchored to the dock's save-status
 * button (see SaveStatusIndicator) so it reads as coming out of the status pill
 * rather than as a detached banner.
 */
export function RestoreAutosaveNudge({
	whenCreated,
	error,
	isBusy,
	onRestore,
	onKeepNew,
	onDismiss,
}: {
	whenCreated?: number;
	error?: string;
	isBusy: boolean;
	onRestore: () => void;
	onKeepNew: () => void;
	onDismiss: () => void;
}) {
	const createdAt = new Date(whenCreated ?? Date.now());

	return (
		<div className={css.nudge} aria-label="Recent autosaved Playground">
			<button
				type="button"
				className={css.close}
				aria-label="Dismiss"
				onClick={onDismiss}
			>
				<Icon icon={close} size={18} />
			</button>
			<div className={css.copy}>
				<div className={css.title}>Recent autosave available</div>
				<div className={css.description}>
					Another Playground was created {getRelativeDate(createdAt)}{' '}
					from the same URL.
				</div>
				{error && <div className={css.error}>{error}</div>}
			</div>
			<div className={css.actions}>
				<Button
					variant="tertiary"
					onClick={onKeepNew}
					disabled={isBusy}
				>
					No, thanks
				</Button>
				<Button variant="primary" onClick={onRestore} disabled={isBusy}>
					Restore Autosave
				</Button>
			</div>
		</div>
	);
}
