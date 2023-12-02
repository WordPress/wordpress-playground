import { readFileSync } from 'fs';

export async function getWordPressDataModule() {
	const wpData = readFileSync(
		__dirname + '/../../../remote/src/wordpress/wp-6.3.data'
	);
	const wpDataArrayBuffer = wpData.buffer.slice(
		wpData.byteOffset,
		wpData.byteOffset + wpData.byteLength
	);
	shimXHR(wpDataArrayBuffer);
	// @ts-ignore
	return await import(__dirname + '/../../../remote/src/wordpress/wp-6.3.js');
}

function shimXHR(response: ArrayBuffer) {
	// Shim XMLHttpRequest to return a fixed response
	// @ts-ignore
	globalThis.XMLHttpRequest = class XMLHttpRequest {
		response?: ArrayBuffer;
		onload() {}
		open() {
			setTimeout(() => {
				this.response = response;
				this.onload();
			}, 100);
		}
		send() {}
		setRequestHeader() {}
		getResponseHeader() {}
		getAllResponseHeaders() {}
		abort() {}
		addEventListener() {}
		removeEventListener() {}
		dispatchEvent() {}
		get readyState() {
			return 4;
		}
		get status() {
			return 200;
		}
	};
}
