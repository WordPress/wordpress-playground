import { EnsurePlaygroundSiteIsSelected } from './ensure-playground-site-is-selected';
import { EnsurePlaygroundSiteSlug } from './ensure-playground-site-slug';

export function EnsurePlaygroundSite({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<EnsurePlaygroundSiteSlug>
			<EnsurePlaygroundSiteIsSelected>
				{children}
			</EnsurePlaygroundSiteIsSelected>
		</EnsurePlaygroundSiteSlug>
	);
}
