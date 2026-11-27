import React, { useState } from 'react';
import {
	Button,
	Notice,
	__experimentalText as Text,
} from '@wordpress/components';
import type { AgentSiteAccessActions, AgentSiteAccessSnapshot } from './types';
import { formatAgentSite } from './format';
import css from './style.module.css';

export function AgentAccessPanel({
	access,
	snapshot,
}: {
	access: AgentSiteAccessActions | undefined;
	snapshot: AgentSiteAccessSnapshot | undefined;
}) {
	const [error, setError] = useState<string>();
	if (!access || !snapshot) {
		return <Text>Agent access is unavailable in this browser.</Text>;
	}
	const run = (action: () => Promise<void>) => {
		setError(undefined);
		action().catch((e: unknown) =>
			setError(e instanceof Error ? e.message : String(e))
		);
	};
	const { grants, earlierSites, calls } = snapshot;
	const siteNames = new Map(
		earlierSites.map((site) => [
			site.siteId,
			formatAgentSite(site, earlierSites),
		])
	);
	return (
		<div className={css['panel']}>
			{(snapshot.error || error) && (
				<Notice status="error" isDismissible={false}>
					{snapshot.error ?? error}
				</Notice>
			)}
			{!snapshot.error && (
				<section>
					<h3 className={css['heading']}>Active access</h3>
					{grants.length === 0 ? (
						<Text>No sites are open to agents.</Text>
					) : (
						<ul className={css['list']}>
							{grants.map((grant) => (
								<li key={grant.grantId} className={css['item']}>
									<div className={css['details']}>
										<strong>
											{formatAgentSite(
												grant.site,
												earlierSites
											)}
										</strong>
										<span className={css['meta']}>
											{grant.inThisTab
												? 'This tab'
												: 'Another tab'}{' '}
											· Expires{' '}
											{formatTime(grant.expiresAt)}
										</span>
										{grant.crossSiteWith.length > 0 && (
											<span className={css['meta']}>
												Shared with{' '}
												{grant.crossSiteWith
													.map((site) =>
														formatAgentSite(
															site,
															earlierSites
														)
													)
													.join(', ')}
											</span>
										)}
									</div>
									<Button
										variant="secondary"
										size="compact"
										aria-label={`Revoke access to ${formatAgentSite(grant.site, earlierSites)} in ${grant.inThisTab ? 'this tab' : 'another tab'}`}
										onClick={() =>
											run(() =>
												access.revoke(grant.grantId)
											)
										}
									>
										Revoke
									</Button>
								</li>
							))}
						</ul>
					)}
				</section>
			)}
			{earlierSites.length > 0 && (
				<details className={css['disclosure']}>
					<summary>
						Site history{' '}
						<span className={css['meta']}>
							({earlierSites.length})
						</span>
					</summary>
					<ul className={css['list']}>
						{earlierSites.map((site) => (
							<li key={site.siteId} className={css['item']}>
								<span>
									{formatAgentSite(site, earlierSites)}
								</span>
								<span className={css['meta']}>
									Last used {formatTime(site.lastUsedAt)}
								</span>
							</li>
						))}
					</ul>
				</details>
			)}
			{calls.length > 0 && (
				<details className={css['disclosure']}>
					<summary>
						Actions in this tab{' '}
						<span className={css['meta']}>({calls.length})</span>
					</summary>
					<ol className={css['list']}>
						{calls.map((call, index) => (
							<li key={index} className={css['item']}>
								<div className={css['details']}>
									<code>{call.tool}</code>
									<span className={css['meta']}>
										{siteNames.get(call.siteId) ??
											call.siteId}{' '}
										· {formatTime(call.at)}
									</span>
									{call.summary && (
										<code className={css['meta']}>
											{call.summary}
										</code>
									)}
								</div>
							</li>
						))}
					</ol>
				</details>
			)}
			{(grants.length + earlierSites.length + calls.length > 0 ||
				snapshot.error) && (
				<Button
					variant="tertiary"
					isDestructive
					onClick={() => run(() => access.endSession())}
				>
					End agent session
				</Button>
			)}
		</div>
	);
}

function formatTime(time: number) {
	return new Date(time).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}
