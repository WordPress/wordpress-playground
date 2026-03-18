import { useState } from 'react';
import { Notice, Button } from '@wordpress/components';
import { isIOSSafari, isRunningAsPWA } from '../../lib/is-ios-safari';
import css from './style.module.css';

const DISMISS_KEY = 'playground-ios-pwa-notice-dismissed';

function isDismissedInStorage(): boolean {
	try {
		return localStorage.getItem(DISMISS_KEY) === 'true';
	} catch {
		return false;
	}
}

function persistDismissal(): void {
	try {
		localStorage.setItem(DISMISS_KEY, 'true');
	} catch {
		// Storage unavailable — the notice will reappear on
		// next visit, which is acceptable.
	}
}

/**
 * A dismissible notice shown to iOS/iPadOS Safari users who have
 * not installed the app as a PWA. It explains the risk of data
 * loss due to Safari's Intelligent Tracking Prevention (ITP)
 * which can wipe all script-writable storage after 7 days of
 * inactivity, and encourages the user to add the app to their
 * Home Screen.
 */
export function IosPwaNotice() {
	const [dismissed, setDismissed] = useState(isDismissedInStorage);

	if (dismissed || !isIOSSafari() || isRunningAsPWA()) {
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
			className={css.iosPwaNotice}
		>
			<div className={css.content}>
				<p className={css.headline}>
					<strong>
						Your data may be erased by Safari after 7 days
					</strong>
				</p>
				<p className={css.body}>
					Safari automatically clears website data after 7 days of
					inactivity. To keep your WordPress data safe, install this
					app to your Home Screen.
				</p>
				<div className={css.instructions}>
					<p className={css.step}>
						Tap the{' '}
						<strong>
							Share button{' '}
							<span
								className={css.shareIcon}
								role="img"
								aria-label="share"
							>
								{/* Safari share icon (box with arrow) */}
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
									<polyline points="16 6 12 2 8 6" />
									<line x1="12" y1="2" x2="12" y2="15" />
								</svg>
							</span>
						</strong>{' '}
						then choose{' '}
						<strong>&quot;Add to Home Screen&quot;</strong>.
					</p>
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
