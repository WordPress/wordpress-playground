export function utf8ToBase64(str: string) {
	return window.btoa(unescape(encodeURIComponent(str)));
}

export function base64ToUtf8(str: string) {
	return decodeURIComponent(escape(window.atob(str)));
}
