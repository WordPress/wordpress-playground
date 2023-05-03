import { useEffect, useState } from 'react';
import { useHasTransitionClassName } from '../../hooks/use-has-transition-class-name';
// @ts-ignore
import classes from './style.module.css';

interface CodeOutputProps {
	result?: string;
	isRunning: boolean;
}
export function CodeOutput({ result, isRunning }: CodeOutputProps) {
	const hasIsReadyClass = useHasTransitionClassName(!isRunning, 250);
	const [displaySpinner, setDisplaySpinner] = useState(false);

	// Only show the spinner if the PHP is taking a while to execute the code
	useEffect(() => {
		if (!isRunning) {
			setDisplaySpinner(false);
			return;
		}

		const timeout = setTimeout(() => {
			setDisplaySpinner(true);
		}, 20);
		return () => clearTimeout(timeout);
	}, [isRunning]);

	const className = [
		classes.output,
		hasIsReadyClass ? classes.isReady : '',
		displaySpinner ? 'is-spinner-active' : '',
	].join(' ');

	return (
		<div>
			<div className={classes.title}>Output:</div>
			<div className={className}>
				<pre>{result}</pre>
			</div>
		</div>
	);
}
