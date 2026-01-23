import React from 'react';
import Admonition from '@theme/Admonition';

export interface Contributor {
	name: string;
	profileUrl: string;
}

export interface TranslationCreditsProps {
	/**
	 * List of translators who contributed to the translation
	 */
	translators?: Contributor[];
	/**
	 * List of reviewers who reviewed the translation
	 */
	reviewers?: Contributor[];
	/**
	 * The date of the last update (e.g., "6 octobre 2025")
	 */
	lastUpdated: string;
	/**
	 * Label for "Translation by" (localized)
	 * @default "Translation by"
	 */
	translationLabel?: string;
	/**
	 * Label for "Review by" (localized)
	 * @default "and review by"
	 */
	reviewLabel?: string;
	/**
	 * Label for "Automated translation" (localized)
	 * @default "Automated translation"
	 */
	automatedLabel?: string;
	/**
	 * Label for "review and corrections by" (localized)
	 * @default "review and corrections by"
	 */
	automatedReviewLabel?: string;
	/**
	 * Label for "Last updated on" (localized)
	 * @default "Last updated on"
	 */
	lastUpdatedLabel?: string;
	/**
	 * Whether this is an automated translation
	 * @default false
	 */
	isAutomated?: boolean;
}

function ContributorLink({ contributor }: { contributor: Contributor }) {
	return (
		<a
			href={contributor.profileUrl}
			target="_blank"
			rel="noopener noreferrer"
		>
			@{contributor.name}
		</a>
	);
}

function ContributorList({ contributors }: { contributors: Contributor[] }) {
	return (
		<>
			{contributors.map((contributor, index) => (
				<span key={contributor.name}>
					{index > 0 && index === contributors.length - 1 && ' & '}
					{index > 0 && index < contributors.length - 1 && ', '}
					<ContributorLink contributor={contributor} />
				</span>
			))}
		</>
	);
}

export function TranslationCredits({
	translators,
	reviewers,
	lastUpdated,
	translationLabel = 'Translation by',
	reviewLabel = 'and review by',
	automatedLabel = 'Automated translation',
	automatedReviewLabel = 'review and corrections by',
	lastUpdatedLabel = 'Last updated on',
	isAutomated = false,
}: TranslationCreditsProps) {
	return (
		<div className="translation-credits-wrapper">
			<Admonition type="info" title="">
				<span className="translation-credits">
					{isAutomated ? (
						<>
							{automatedLabel}
							{reviewers && reviewers.length > 0 && (
								<>
									, {automatedReviewLabel}{' '}
									<ContributorList contributors={reviewers} />
								</>
							)}
						</>
					) : (
						<>
							{translators && translators.length > 0 && (
								<>
									{translationLabel}{' '}
									<ContributorList
										contributors={translators}
									/>
								</>
							)}
							{reviewers && reviewers.length > 0 && (
								<>
									{' '}
									{reviewLabel}{' '}
									<ContributorList contributors={reviewers} />
								</>
							)}
						</>
					)}
				</span>
				<span className="translation-credits-date">
					{lastUpdatedLabel} {lastUpdated}
				</span>
			</Admonition>
		</div>
	);
}

export default TranslationCredits;
