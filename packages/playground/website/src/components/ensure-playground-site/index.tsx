import type { OriginSetup } from '../../lib/origin-isolation';
import { EnsurePlaygroundSiteIsSelected } from './ensure-playground-site-is-selected';

/** Pass the origin’s one-time boot claim into site selection before rendering its tools. */
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
