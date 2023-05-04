// @ts-ignore
import classes from './style.module.css';

export function ProgressBar({ progress }: { progress: number }) {
	return (
		<div className={classes.root}>
			Loading PHP...
			<div className={classes.wrapper}>
				<div
					className={classes.bar}
					style={{ width: `${progress}%` }}
				></div>
			</div>
		</div>
	);
}
