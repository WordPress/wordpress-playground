export const isUploadedFilePath = (path: string) =>
	/^\/wp-content\/(?:fonts|(?:mu-)?plugins|themes|uploads)\//.test(path);
