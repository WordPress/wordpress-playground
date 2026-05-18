import { Notice, Flex, FlexItem, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import css from './style.module.css';
import { SitePersistButton } from '../site-persist-button';
import { useState } from 'react';
import classNames from 'classnames';
import { usePlaygroundClient } from '../../../lib/use-playground-client';
import { useActiveSite } from '../../../lib/state/redux/store';
import { isSaveDisabledByQueryParam } from '../../../lib/state/url/router';

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
	if (isDismissed || isSaveDisabledByQueryParam()) {
		return null;
	}
	return (
		<Notice
			className={classNames(css.siteNotice, className)}
			spokenMessage={__(
				'This is an Unsaved Playground. Your changes will be lost on page refresh.',
				'playground-website'
			)}
			status="info"
			isDismissible={isDismissible}
			onDismiss={() => setIsDismissed(true)}
		>
			<Flex direction="row" gap={2} expanded={true}>
				<FlexItem>
					<b>
						{__(
							'This is an Unsaved Playground.',
							'playground-website'
						)}
					</b>{' '}
					{__(
						'Your changes will be lost on page refresh.',
						'playground-website'
					)}
				</FlexItem>
				<FlexItem>
					<SitePersistButton siteSlug={site.slug}>
						<Button
							variant="primary"
							disabled={!playground}
							aria-label={__(
								'Save site locally',
								'playground-website'
							)}
						>
							{__('Save', 'playground-website')}
						</Button>
					</SitePersistButton>
				</FlexItem>
			</Flex>
		</Notice>
	);
}
