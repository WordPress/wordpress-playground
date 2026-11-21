import React from 'react';
import {
	Button,
	Flex,
	Notice,
	__experimentalText as Text,
} from '@wordpress/components';
import type { AgentSiteAccessDecision, AgentSiteAccessRequest } from './types';
import { formatAgentSite } from './format';
import css from './style.module.css';

export function SiteAccessDialogContent({
	request,
	onAnswer,
}: {
	request: AgentSiteAccessRequest;
	onAnswer: (decision: AgentSiteAccessDecision) => void;
}) {
	const peers = [
		request.site,
		...request.earlierSites,
		...request.sitesWithAccess,
	];
	const label = (site: AgentSiteAccessRequest['site']) =>
		formatAgentSite(site, peers);
	const hasOtherAccess = request.sitesWithAccess.length > 0;
	return (
		<div className={css['dialog']}>
			<Text>
				The agent can read and change files and data on{' '}
				<strong>{label(request.site)}</strong>, run PHP, and use site
				tools.
			</Text>
			{request.reason && (
				<div className={css['reason']}>
					<strong>Agent’s reason</strong>
					<blockquote>{request.reason}</blockquote>
				</div>
			)}
			{request.earlierSites.length > 0 && (
				<Notice status="warning" isDismissible={false}>
					The agent used {request.earlierSites.map(label).join(', ')}{' '}
					earlier. This site could ask it to share information from
					those sites.
				</Notice>
			)}
			{hasOtherAccess && (
				<Text>
					Allowing only this site ends access to{' '}
					{request.sitesWithAccess.map(label).join(', ')}.
				</Text>
			)}
			<Flex gap={2} justify="end" wrap className={css['dialogButtons']}>
				<Button variant="tertiary" onClick={() => onAnswer('deny')}>
					Deny
				</Button>
				{hasOtherAccess && request.reason && (
					<Button
						variant="secondary"
						onClick={() => onAnswer('allow-cross-site')}
					>
						Keep access to all sites
					</Button>
				)}
				<Button
					variant="primary"
					onClick={() =>
						onAnswer(
							hasOtherAccess ? 'allow-revoke-others' : 'allow'
						)
					}
				>
					{hasOtherAccess ? 'Allow only this site' : 'Allow'}
				</Button>
			</Flex>
		</div>
	);
}
