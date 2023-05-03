export function setFileName(url: URL, newFilename: any) {
	const currentScriptPath = url.pathname.split('/').slice(0, -1).join('/');
	url.pathname = `${currentScriptPath}/${newFilename}`;
	return url;
}
