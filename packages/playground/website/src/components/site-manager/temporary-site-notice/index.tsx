import { Notice, Flex, FlexItem, Button } from '@wordpress/components';
import css from './style.module.css';
import { useActiveSite } from '../../../lib/state/redux/store';
import { SitePersistButton } from '../site-persist-button';
import { useState } from 'react';
import classNames from 'classnames';
import { usePlaygroundClient } from '../../../lib/use-playground-client';

export function TemporarySiteNotice({
	isDismissible = false,
	className,
}: {
	isDismissible?: boolean;
	className?: string;
}) {
	const [isDismissed, setIsDismissed] = useState(false);
	const site = useActiveSite()!;
	const playground = usePlaygroundClient(site.slug);
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
					<SitePersistButton siteSlug={site.slug}>
						<Button variant="primary" disabled={!playground}>
							Save
						</Button>
					</SitePersistButton>
				</FlexItem>
			</Flex>
		</Notice>
	);
}
