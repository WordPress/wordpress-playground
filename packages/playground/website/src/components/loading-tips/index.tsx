import React from 'react';
import { useRotatingTips } from '../../lib/hooks/use-rotating-tips';
import css from './style.module.css';

interface LoadingTipsProps {
	intervalMs?: number;
}

export function LoadingTips({ intervalMs = 7000 }: LoadingTipsProps) {
	const { currentTip, isFading } = useRotatingTips(intervalMs);

	return (
		<div
			className={css.tipsContainer}
			aria-live="polite"
			aria-atomic="true"
		>
			<p className={`${css.tipText} ${isFading ? css.fadingOut : ''}`}>
				{currentTip}
			</p>
		</div>
	);
}
