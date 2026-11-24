export function validateWordPressStaticDocuments(
	directory: string
): Promise<void>;
export function protectStaticReleasePages(
	directory: string,
	appOrigin: string,
	wordPressOrigin: string
): Promise<void>;
