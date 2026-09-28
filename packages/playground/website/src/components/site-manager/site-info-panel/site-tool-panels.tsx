import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { SITE_TOOLS } from '../../dock/tool-registry';
import type { SiteToolSection } from '../../dock/tool-registry';
import { useDockPaneEditorHeaderSlot } from '../../dock/dock-pane';
import type { SiteToolPanelProps } from './site-tool-renderers';
import css from './style.module.css';

export type SiteInfoTabName = SiteToolSection;

/** Mounts tools on first use and retains their state until the active site changes. */
export function SiteToolPanels({
	site,
	playground,
	activeTabName,
	mobileUi = false,
}: {
	site: SiteToolPanelProps['site'];
	playground: SiteToolPanelProps['playground'];
	activeTabName: SiteInfoTabName | null;
	mobileUi?: boolean;
}) {
	const [mountedTabNames, setMountedTabNames] = useState<SiteInfoTabName[]>(
		() => (activeTabName ? [activeTabName] : [])
	);
	const editorHeaderSlot = useDockPaneEditorHeaderSlot();
	useEffect(() => {
		if (activeTabName) {
			setMountedTabNames((names) =>
				names.includes(activeTabName)
					? names
					: [...names, activeTabName]
			);
		}
	}, [activeTabName]);
	return (
		<>
			{SITE_TOOLS.map(({ section, Panel, panelClassName }) => {
				const isVisible = section === activeTabName;
				if (!isVisible && !mountedTabNames.includes(section))
					return null;
				return (
					<div
						key={section}
						className={classNames(panelClassName, {
							[css.tabHidden]: !isVisible,
						})}
						hidden={!isVisible}
					>
						<Panel
							site={site}
							playground={playground}
							isVisible={isVisible}
							mobileHeaderTarget={
								isVisible && mobileUi ? editorHeaderSlot : null
							}
						/>
					</div>
				);
			})}
		</>
	);
}
