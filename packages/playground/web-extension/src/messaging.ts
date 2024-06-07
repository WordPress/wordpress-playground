import { PHPRequest, PHPResponse } from '@php-wasm/universal';

export const uint8ArrayToBase64 = (bytes: Uint8Array) => {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
};

export const base64ToUint8Array = (base64: string) => {
	const byteCharacters = atob(base64);
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	return new Uint8Array(byteNumbers);
};

export function sendPhpRequest(request: PHPRequest): Promise<PHPResponse> {
	return new Promise((resolve) => {
		const encodedRequest = { ...request };
		if (encodedRequest.body && encodedRequest.body instanceof Uint8Array) {
			encodedRequest.body = uint8ArrayToBase64(encodedRequest.body);
		}
		chrome.runtime.sendMessage(
			{
				type: 'PLAYGROUND_REQUEST',
				request: encodedRequest,
			},
			(encodedResponse) => {
				const decodedResponse = {
					...encodedResponse,
					bytes: base64ToUint8Array(encodedResponse.bytes),
				};
				resolve(decodedResponse);
			}
		);
	});
}

export const listenForPhpRequests = (
	callback: (request: PHPRequest) => Promise<PHPResponse>
) => {
	chrome.runtime.onMessage.addListener(
		async (message, sender, sendResponse) => {
			if (message.type === 'PLAYGROUND_REQUEST') {
				const decodedRequest = { ...message.request };
				if (
					decodedRequest.body &&
					typeof decodedRequest.body === 'string'
				) {
					decodedRequest.body = base64ToUint8Array(
						decodedRequest.body
					);
				}
				const response = await callback(decodedRequest);
				const encodedResponse = {
					headers: response.headers,
					httpStatusCode: response.httpStatusCode,
					errors: response.errors,
					bytes: uint8ArrayToBase64(new Uint8Array(response.bytes)),
				};
				sendResponse(encodedResponse);
			}
		}
	);
};
