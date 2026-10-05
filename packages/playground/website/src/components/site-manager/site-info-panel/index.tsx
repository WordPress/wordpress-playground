import { Flex, FlexItem } from '@wordpress/components';
import classNames from 'classnames';
import { selectClientInfoBySiteSlug } from '../../../lib/state/redux/slice-clients';
import type { SiteInfo } from '../../../lib/state/redux/slice-sites';
import { useAppSelector } from '../../../lib/state/redux/store';
import { SiteToolPanels, type SiteInfoTabName } from './site-tool-panels';
import type { SiteToolPanelProps } from './site-tool-renderers';
import css from './style.module.css';

export type { SiteInfoTabName } from './site-tool-panels';

/** Exposes the active site tool inside the Dock pane. */
export function SiteInfoPanel({
	className,
	site,
	activeTabName,
	mobileUi,
	onBackChange,
	onCloseBlockedChange,
}: {
	className: string;
	site: SiteInfo;
	mobileUi: boolean;
	onBackChange?: SiteToolPanelProps['onBackChange'];
	onCloseBlockedChange?: SiteToolPanelProps['onCloseBlockedChange'];
	activeTabName: SiteInfoTabName | null;
}) {
	const clientInfo = useAppSelector((state) =>
		selectClientInfoBySiteSlug(state, site.slug)
	);
	const playground = clientInfo?.client;

	return (
		<section
			className={classNames(className, css.siteInfoPanel, {
				[css.siteInfoPanelHidden]: !activeTabName,
			})}
			hidden={!activeTabName}
		>
			<Flex
				direction="column"
				gap={1}
				justify="flex-start"
				expanded={true}
				className={css.siteInfoPanelContent}
			>
				<FlexItem
					style={{
						display: 'flex',
						flexDirection: 'column',
						flexGrow: 1,
						minHeight: 0,
					}}
				>
					<SiteToolPanels
						site={site}
						playground={playground}
						activeTabName={activeTabName}
						mobileUi={mobileUi}
						onBackChange={onBackChange}
						onCloseBlockedChange={onCloseBlockedChange}
					/>
				</FlexItem>
			</Flex>
		</section>
	);
}
