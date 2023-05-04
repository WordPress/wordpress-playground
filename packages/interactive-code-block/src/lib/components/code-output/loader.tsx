import React from 'react';
// @ts-ignore
import classes from './style.module.css';
import { ProgressBar } from '../progress-bar';

export function CodeOutputLoader({ progress }: { progress: number }) {
	return (
		<div>
			<div className={classes.title}>
				<b>Output:</b>
			</div>
			<div className={classes.output}>
				<ProgressBar progress={progress} />
			</div>
		</div>
	);
}
