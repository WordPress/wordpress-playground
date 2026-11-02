/**
 * Original Query API setup params captured when a Playground is created.
 *
 * These fields are stored separately from runtime configuration because some
 * setup choices, such as `language` and repeated `plugin` params, are needed
 * later when recreating the same Playground but are not runtime boot settings.
 */
export type OriginalUrlParams = {
	searchParams?: Record<string, string | string[]>;
	hash?: string;
};
