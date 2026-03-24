import React from 'react';
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
					Blueprint failed at step #{stepError.stepNumber}: Could not{' '}
					{stepError.description}.
				</p>
			</div>
			{stepError.messages.length > 0 &&
				stepError.messages.map((line, index) => (
					<p key={index} className={css.stepErrorMessage}>
						{line}
					</p>
				))}
			<div className={css.stepErrorCodeWrapper}>
				<div className={css.stepErrorLabel}>Step definition</div>
				<pre className={css.stepErrorCode}>{stepError.stepJson}</pre>
			</div>
		</div>
	);
}
