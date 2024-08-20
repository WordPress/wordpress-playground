import { Button } from '@wordpress/components';
import { LogModal } from '../log-modal';
import { useState } from '@wordpress/element';

import css from './style.module.css';

export const localStorageKey = 'playground-start-error-dont-show-again';

export function StartErrorModal() {
	const [dontShowAgain, setDontShowAgain] = useState(
		localStorage.getItem(localStorageKey) === 'true'
	);

	if (dontShowAgain) {
		return null;
	}

	const dismiss = () => {
		localStorage.setItem(localStorageKey, 'true');
		setDontShowAgain(true);
	};

	const description = (
		<>
			<p>
				Oops! There was a problem starting Playground. To figure out
				what went wrong, please take a look at the error logs provided
				below. If you see an "Invalid blueprint error," the logs will
				point out the specific step causing the issue. You can then
				double-check your blueprint. For more help, you can also{' '}
				<a
					href="https://wordpress.github.io/wordpress-playground/blueprints/troubleshoot-and-debug-blueprints"
					target="_blank"
					rel="noreferrer"
				>
					visit our documentation.
				</a>{' '}
			</p>
			<Button
				className={css.startErrorModalDismiss}
				text="Don't show again"
				onClick={dismiss}
				variant="secondary"
				isSmall={true}
			/>
		</>
	);
	return <LogModal title="Error" description={description} />;
}
