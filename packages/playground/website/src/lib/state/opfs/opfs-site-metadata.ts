import { getBlueprintDeclaration } from '@wp-playground/blueprints';
import type { SiteMetadata } from '../redux/slice-sites';
import type { OriginalUrlParams } from '../original-url-params';

export async function metadataToStoredFormat(
	slug: string,
	{ originalBlueprint, originalBlueprintSource, ...metadata }: SiteMetadata,
	originalUrlParams?: OriginalUrlParams
): Promise<string> {
	return JSON.stringify(
		{
			slug,
			originalUrlParams,
			originalBlueprintSource,
			/**
			 * Site metadata stores Blueprint declaration JSON, not arbitrary
			 * bundle files. When the source is not `opfs-site`, saving records
			 * `blueprint.json` only; bundled resource files are not copied into
			 * the metadata file. Autosaved Playgrounds persist editable bundle
			 * files beside WordPress files, so metadata points at that OPFS
			 * bundle directory instead of duplicating the declaration here.
			 */
			originalBlueprint:
				originalBlueprintSource?.type === 'opfs-site'
					? undefined
					: await getBlueprintDeclaration(originalBlueprint as any),
			...metadata,
		},
		undefined,
		'  '
	);
}
