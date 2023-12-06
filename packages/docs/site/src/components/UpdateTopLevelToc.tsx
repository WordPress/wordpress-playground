import { useEffect } from 'react';

type TocItem = {
	value: string;
	id: string;
	level: number;
};
interface Props {
	toc: TocItem[];
	tocItems: TocItem[];
}

/**
 * Adds the missing steps to the Table of Contents and triggers a re-render.
 *
 * This is a workaround. Docusaurus doesn't support dynamic TOC based on the
 * h2, h3 etc elements rendered by React components. Therefore, we have to update
 * the global `toc` variable. Once we do, we also need to trigger a TOC re-render
 * which can be done by updating the current URL hash.
 */
export default function UpdateTopLevelToc({ tocItems, toc }: Props) {
	useEffect(() => {
		const missingItems = tocItems.filter(
			(tocItem) =>
				!toc.find(
					(topLevelTocItem) => topLevelTocItem.id === tocItem.id
				)
		);
		for (const tocItem of missingItems) {
			toc.push(tocItem);
		}

		// Re-render the TOC
		if (missingItems.length) {
			const oldHash = window.location.hash;
			window.location.hash = '#__reload__';
			window.location.hash = oldHash;
		}
	}, [tocItems, toc]);
	return null;
}
