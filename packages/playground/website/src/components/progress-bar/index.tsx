import type { ProgressMode } from '@wp-playground/php-wasm-progress';
import classNames from 'classnames';
import React from 'react';
import css from './style.module.css';

interface ProgressBarProps {
	caption: string;
	percentFull: number;
	mode: ProgressMode;
	isIndefinite?: boolean;
	visible?: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
	caption,
	percentFull,
	mode,
	isIndefinite,
	visible,
}: ProgressBarProps) => {
	const classes = classNames([css.overlay], {
		[css.isHidden]: !visible,
	});
	return (
		<div className={classes}>
			<h3 className={css.caption}>{caption}</h3>
			{isIndefinite ? (
				<ProgressIndefinite />
			) : (
				<Progress mode={mode} percentFull={percentFull} />
			)}
		</div>
	);
};

const Progress = ({ mode, percentFull }) => {
	const classes = classNames([css.progressBar, css.isDefinite], {
		[css.slowlyIncrementing]: mode === 'slowly-increment',
	});
	return (
		<div className={`${css.wrapper} ${css.wrapperDefinite}`}>
			<div className={classes} style={{ width: `${percentFull}%` }} />
		</div>
	);
};

const ProgressIndefinite = () => {
	return (
		<div className={`${css.wrapper} ${css.wrapperIndefinite}`}>
			<div className={`${css.progressBar} ${css.isIndefinite}`} />
		</div>
	);
};

export default ProgressBar;
