export interface UniversalPHP {
	/**
	 * Read the content of a file as text.
	 *
	 * @param path The path to the file
	 * @returns string The content of the file
	 */
	readFileAsText(path: string): Promise<string>;
	/**
	 * Check if a file exists.
	 *
	 * @param path The path to the file
	 * @returns boolean Whether the file exists
	 */
	fileExists(path: string): Promise<boolean>;
}

export const LatestSupportedPHPVersion = '8.3';
