import type { ReactNode } from 'react';
import classNames from 'classnames';
import css from './style.module.css';

interface BrowserChromeProps {
	children?: ReactNode;
	className?: string;
}

/** Renders the preview surface after the Dock takes ownership of app chrome. */
export default function BrowserChrome({
	children,
	className,
}: BrowserChromeProps) {
	return (
		<div
			className={classNames(
				css.wrapper,
				css.hasFullSizeWindow,
				className
			)}
			data-cy="simulated-browser"
		>
			<div className={`${css.window} browser-chrome-window`}>
				<div className={css.content}>{children}</div>
			</div>
		</div>
	);
}
