import type { ReactNode } from 'react';
import { Button as WordPressButton } from '@wordpress/components';
import Button from '../button';
import { useAppUpdate } from '../../lib/pwa-update/use-app-update';
import css from './style.module.css';

export function AppUpdateGate({ children }: { children: ReactNode }) {
	const appUpdate = useAppUpdate();

	if (!appUpdate.initialCheckCompleted) {
		return <AppUpdateLoading />;
	}

	if (appUpdate.updateRequired) {
		return <AppUpdateRequired />;
	}

	return children;
}

export function AppUpdateNotice() {
	const appUpdate = useAppUpdate();

	if (!appUpdate.showUpdateNotice) {
		return null;
	}

	return (
		<div className={css.notice} role="status" aria-live="polite">
			<div className={css.noticeContent}>
				<strong>Update available</strong>
				<span>Restart My WordPress to load the latest version.</span>
			</div>
			<div className={css.noticeActions}>
				<WordPressButton
					variant="primary"
					type="button"
					onClick={appUpdate.applyUpdate}
					disabled={appUpdate.isApplying}
				>
					{appUpdate.isApplying ? 'Updating...' : 'Update now'}
				</WordPressButton>
				<WordPressButton
					type="button"
					variant="secondary"
					onClick={appUpdate.dismissUpdate}
					disabled={appUpdate.isApplying}
				>
					Later
				</WordPressButton>
			</div>
		</div>
	);
}

function AppUpdateRequired() {
	const appUpdate = useAppUpdate();

	return (
		<div
			className={css.requiredScreen}
			role="dialog"
			aria-modal="true"
			aria-labelledby="app-update-required-title"
		>
			<div className={css.requiredPanel}>
				<p className={css.eyebrow}>New version ready</p>
				<h1 id="app-update-required-title">Update My WordPress</h1>
				<p>
					This installed app is from an older release. Update before
					opening your site so WordPress starts with the current
					files.
				</p>
				<Button
					variant="primary"
					size="large"
					type="button"
					onClick={appUpdate.applyUpdate}
					disabled={appUpdate.isApplying}
				>
					{appUpdate.isApplying ? 'Updating...' : 'Update now'}
				</Button>
			</div>
		</div>
	);
}

function AppUpdateLoading() {
	return (
		<div className={css.loadingScreen} role="status" aria-live="polite">
			<div className={css.loadingMark} />
			<span>Loading My WordPress</span>
		</div>
	);
}
