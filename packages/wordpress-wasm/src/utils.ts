export const isUploadedFilePath = (path) => {
	return (
		path.startsWith('/wp-content/uploads/') ||
		path.startsWith('/wp-content/plugins/') ||
		(path.startsWith('/wp-content/themes/') &&
			!path.startsWith('/wp-content/themes/twentytwentytwo/'))
	);
};
