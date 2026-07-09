import { TabPanel } from '@wordpress/components';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import css from './style.module.css';

export type DockTab = {
	name: string;
	title: string;
	disabled?: boolean;
};

export type DockTabsProps = {
	ariaLabel: string;
	tabs: DockTab[];
	children: (tab: DockTab) => ReactNode;
	className?: string;
	initialTabName?: string;
	onSelect?: (tabName: string) => void;
};

/**
 * Renders a named dock tab region while delegating tab ARIA and keyboard
 * behavior to WordPress's public TabPanel component.
 */
export function DockTabs({
	ariaLabel,
	tabs,
	children,
	className,
	initialTabName,
	onSelect,
}: DockTabsProps) {
	return (
		<div
			className={classNames(css.dockTabs, className)}
			role="region"
			aria-label={ariaLabel}
		>
			<TabPanel
				className={css.dockTabsPanel}
				tabs={tabs}
				initialTabName={initialTabName}
				onSelect={onSelect}
			>
				{children}
			</TabPanel>
		</div>
	);
}
