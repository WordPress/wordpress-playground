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
				An error occurred while starting Playground. Please read the
				logs below to understand the issue. If there is Invalid
				blueprint error, the error will include the step which caused
				the issue. You can review your blueprint and{' '}
				<a href="https://wordpress.github.io/wordpress-playground/blueprints-api/troubleshoot-and-debug-blueprints">
					check out the documentation
				</a>{' '}
				for more information.
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
