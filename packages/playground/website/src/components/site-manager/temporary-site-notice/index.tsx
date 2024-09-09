import { Notice, Flex, FlexItem } from '@wordpress/components';
import css from './style.module.css';
import { useActiveSite } from '../../../lib/redux-store';
import { SitePersistButton } from '../site-persist-button';
import { useState } from 'react';
import classNames from 'classnames';

export function TemporarySiteNotice({
	isDismissible = false,
	className,
}: {
	isDismissible?: boolean;
	className?: string;
}) {
	const [isDismissed, setIsDismissed] = useState(false);
	const site = useActiveSite()!;
	if (isDismissed) {
		return null;
	}
	return (
		<Notice
			className={classNames(css.siteNotice, className)}
			spokenMessage="This is a temporary site. Your changes will be lost on page refresh."
			status="info"
			isDismissible={isDismissible}
			onDismiss={() => setIsDismissed(true)}
		>
			<Flex direction="row" gap={2} expanded={true}>
				<FlexItem>
					<b>This is a temporary site.</b> Your changes will be lost
					on page refresh.
				</FlexItem>
				<FlexItem>
					<SitePersistButton siteSlug={site.slug} mode="opfs">
						Save in this browser
					</SitePersistButton>
					<SitePersistButton siteSlug={site.slug} mode="local-fs">
						Save on your computer
					</SitePersistButton>
				</FlexItem>
			</Flex>
		</Notice>
	);
}
