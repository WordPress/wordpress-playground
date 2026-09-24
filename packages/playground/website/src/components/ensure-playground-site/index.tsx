import type { OriginSetup } from '../../lib/origin-isolation';
import { EnsurePlaygroundSiteIsSelected } from './ensure-playground-site-is-selected';

export function EnsurePlaygroundSite({
	children,
	setup,
	originWasUsed,
}: {
	children: React.ReactNode;
	setup?: OriginSetup;
	originWasUsed?: boolean;
}) {
	return (
		<EnsurePlaygroundSiteIsSelected
			setup={setup}
			originWasUsed={originWasUsed}
		>
			{children}
		</EnsurePlaygroundSiteIsSelected>
	);
}
