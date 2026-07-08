import React from 'react';
import css from './style.module.css';
import classNames from 'classnames';

interface BrowserChromeProps {
	children?: React.ReactNode;
	className?: string;
}

export default function BrowserChrome({
	children,
	className,
}: BrowserChromeProps) {
	const wrapperClass = classNames(
		css.wrapper,
		css.hasFullSizeWindow,
		className
	);

	// The Playground's identity, save state, address bar, and tools now all
	// live in the floating dock, so the browser window is pure preview surface.
	return (
		<div className={wrapperClass} data-cy="simulated-browser">
			<div className={`${css.window} browser-chrome-window`}>
				<div className={css.content}>{children}</div>
			</div>
		</div>
	);
}
