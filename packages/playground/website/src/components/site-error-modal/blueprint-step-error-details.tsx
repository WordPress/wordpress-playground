import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import css from './style.module.css';
import type { BlueprintStepError } from './types';

interface Props {
	stepError: BlueprintStepError;
}

export function BlueprintStepErrorDetails({ stepError }: Props) {
	return (
		<div className={css.stepError}>
			<div className={css.stepErrorHeader}>
				<p className={css.stepErrorTitle}>
					{sprintf(
						__(
							'Blueprint failed at step #%1$d: Could not %2$s.',
							'playground-website'
						),
						stepError.stepNumber,
						stepError.description
					)}
				</p>
			</div>
			{stepError.messages.length > 0 &&
				stepError.messages.map((line, index) => (
					<p key={index} className={css.stepErrorMessage}>
						{line}
					</p>
				))}
			<div className={css.stepErrorCodeWrapper}>
				<div className={css.stepErrorLabel}>
					{__('Step definition', 'playground-website')}
				</div>
				<pre className={css.stepErrorCode}>{stepError.stepJson}</pre>
			</div>
		</div>
	);
}
