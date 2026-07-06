import { useState } from 'react';
import { Notice, Button, Icon } from '@wordpress/components';
import { share } from '@wordpress/icons';
import {
	getSafariInstallPlatform,
	shouldShowSafariStorageNotice,
} from '../../lib/safari-storage-warning';
import css from './style.module.css';

const DISMISS_KEY = 'playground-safari-storage-notice-dismissed';
const LEGACY_DISMISS_KEY = 'playground-ios-pwa-notice-dismissed';

export function SafariStorageNotice() {
	const [dismissed, setDismissed] = useState(isDismissedInStorage);
	const installPlatform = getSafariInstallPlatform();

	if (dismissed || !installPlatform || !shouldShowSafariStorageNotice()) {
		return null;
	}

	const handleDismiss = () => {
		persistDismissal();
		setDismissed(true);
	};

	return (
		<Notice
			status="warning"
			isDismissible={false}
			className={css.safariStorageNotice}
		>
			<div className={css.content}>
				<p className={css.headline}>
					<strong>
						Safari may erase your WordPress data after 7 days
					</strong>
				</p>
				<p className={css.body}>
					Safari can clear website storage after 7 days of inactivity.
					Install My WordPress as a web app to keep its storage
					separate from Safari and reduce this risk.
				</p>
				<div className={css.instructions}>
					{installPlatform === 'ios' ? (
						<IosInstallInstructions />
					) : (
						<MacosInstallInstructions />
					)}
				</div>
				<div className={css.actions}>
					<Button
						variant="link"
						onClick={handleDismiss}
						className={css.dismissButton}
					>
						Dismiss
					</Button>
				</div>
			</div>
		</Notice>
	);
}

function IosInstallInstructions() {
	return (
		<p className={css.step}>
			Tap the <strong>Share button</strong> <ShareIcon /> then choose{' '}
			<strong>&quot;Add to Home Screen&quot;</strong>.
		</p>
	);
}

function MacosInstallInstructions() {
	return (
		<p className={css.step}>
			Choose <strong>File</strong>, then{' '}
			<strong>&quot;Add to Dock&quot;</strong>. You can also use the{' '}
			<strong>Share button</strong> <ShareIcon /> and choose{' '}
			<strong>&quot;Add to Dock&quot;</strong>.
		</p>
	);
}

function ShareIcon() {
	return (
		<span className={css.shareIcon} aria-hidden="true">
			<Icon icon={share} size={16} />
		</span>
	);
}

function isDismissedInStorage(): boolean {
	try {
		return (
			localStorage.getItem(DISMISS_KEY) === 'true' ||
			localStorage.getItem(LEGACY_DISMISS_KEY) === 'true'
		);
	} catch {
		return false;
	}
}

function persistDismissal(): void {
	try {
		localStorage.setItem(DISMISS_KEY, 'true');
	} catch {
		// Storage unavailable. The notice will reappear on the next visit.
	}
}
