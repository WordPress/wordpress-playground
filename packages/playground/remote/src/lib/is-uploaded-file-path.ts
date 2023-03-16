export const isUploadedFilePath = (path: string) => {
	return (
		path.startsWith('/wp-content/uploads/') ||
		path.startsWith('/wp-content/plugins/') ||
		path.startsWith('/wp-content/mu-plugins/') ||
		path.startsWith('/wp-content/themes/')
	);
};
