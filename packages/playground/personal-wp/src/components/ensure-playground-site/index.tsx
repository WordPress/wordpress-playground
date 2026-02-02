import { EnsurePlaygroundSiteIsSelected } from './ensure-playground-site-is-selected';

export function EnsurePlaygroundSite({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<EnsurePlaygroundSiteIsSelected>
			{children}
		</EnsurePlaygroundSiteIsSelected>
	);
}
