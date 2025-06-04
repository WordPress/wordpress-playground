/*
 * This type is used in Comlink.transferHandlers.set('PHPResponse', { ... })
 * so be sure to update that if you change this type.
 */
export interface PHPResponseData {
	/**
	 * Response headers.
	 */
	readonly headers: Record<string, string[]>;

	/**
	 * Response body. Contains the output from `echo`,
	 * `print`, inline HTML etc.
	 */
	readonly bytes: ArrayBuffer;

	/**
	 * Stderr contents, if any.
	 */
	readonly errors: string;

	/**
	 * The exit code of the script. `0` is a success, while
	 * `1` and `2` indicate an error.
	 */
	readonly exitCode: number;

	/**
	 * Response HTTP status code, e.g. 200.
	 */
	readonly httpStatusCode: number;
}

const responseTexts: Record<number, string> = {
	500: 'Internal Server Error',
	502: 'Bad Gateway',
	404: 'Not Found',
	403: 'Forbidden',
	401: 'Unauthorized',
	400: 'Bad Request',
	301: 'Moved Permanently',
	302: 'Found',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',
	204: 'No Content',
	201: 'Created',
	200: 'OK',
};

export class StreamedPHPResponse {
	/**
	 * Response headers.
	 */
	private readonly headersStream: ReadableStream<Uint8Array>;

	/**
	 * Response body. Contains the output from `echo`,
	 * `print`, inline HTML etc.
	 */
	readonly stdout: ReadableStream<Uint8Array>;

	/**
	 * Stderr contents, if any.
	 */
	readonly stderr: ReadableStream<Uint8Array>;

	/**
	 * The exit code of the script. `0` is a success, anything
	 * else is an error.
	 */
	readonly exitCode: Promise<number>;

	private parsedHeaders: Promise<{
		headers: Record<string, string[]>;
		httpStatusCode: number;
	}> | null = null;

	private cachedStdoutText: Promise<string> | null = null;
	private cachedStderrText: Promise<string> | null = null;

	constructor(
		headers: ReadableStream<Uint8Array>,
		stdout: ReadableStream<Uint8Array>,
		stderr: ReadableStream<Uint8Array>,
		exitCode: Promise<number>
	) {
		this.headersStream = headers;
		this.stdout = stdout;
		this.stderr = stderr;
		this.exitCode = exitCode;
	}

	/**
	 * Returns a promise that resolves to true if the response was successful (status code 200-399),
	 * false otherwise.
	 */
	async ok(): Promise<boolean> {
		try {
			const statusCode = await this.httpStatusCode;
			return statusCode >= 200 && statusCode < 400;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Returns a promise that resolves when the response has finished processing.
	 */
	get finished(): Promise<void> {
		return Promise.allSettled([this.exitCode.finally(() => {})]).then(
			() => {}
		);
	}

	get headers(): Promise<Record<string, string[]>> {
		return this.getParsedHeaders().then((headers) => headers.headers);
	}

	get httpStatusCode(): Promise<number> {
		return this.getParsedHeaders().then(
			(headers) => headers.httpStatusCode,
			() =>
				this.exitCode.then(
					(exitCode) => (exitCode === 0 ? 200 : 500),
					() => 500
				)
		);
	}

	get stdoutText(): Promise<string> {
		if (!this.cachedStdoutText) {
			this.cachedStdoutText = streamToText(this.stdout);
		}
		return this.cachedStdoutText;
	}

	get stderrText(): Promise<string> {
		if (!this.cachedStderrText) {
			this.cachedStderrText = streamToText(this.stderr);
		}
		return this.cachedStderrText;
	}

	private async getParsedHeaders() {
		if (!this.parsedHeaders) {
			this.parsedHeaders = parseHeadersStream(this.headersStream);
		}
		return await this.parsedHeaders;
	}
}

async function parseHeadersStream(
	headersStream: ReadableStream<Uint8Array>
): Promise<{
	headers: Record<string, string[]>;
	httpStatusCode: number;
}> {
	const headersText = await streamToText(headersStream);
	let headersData;
	try {
		headersData = JSON.parse(headersText);
	} catch (e) {
		console.log('error parsing headers', e);
		return { headers: {}, httpStatusCode: 200 };
	}
	const headers: PHPResponse['headers'] = {};
	for (const line of headersData.headers) {
		// Skip invalid response headers and the last "__terminator__" line.
		// @TODO: Should we log a warning on an invalid header line?
		//        What's the typical browser behavior when encountering such a line?
		if (!line.includes(': ')) {
			continue;
		}
		const colonIndex = line.indexOf(': ');
		const headerName = line.substring(0, colonIndex).toLowerCase();
		const headerValue = line.substring(colonIndex + 2);
		if (!(headerName in headers)) {
			headers[headerName] = [] as string[];
		}
		headers[headerName].push(headerValue);
	}
	return {
		headers,
		httpStatusCode: headersData.status,
	};
}

function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
	return new Promise(async (resolve, reject) => {
		const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
		const text: string[] = [];
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					resolve(text.join(''));
					return;
				}
				if (value) {
					text.push(value);
				}
			}
		} catch (e) {
			reject(e);
		}
	});
}

/**
 * PHP response. Body is an `ArrayBuffer` because it can
 * contain binary data.
 *
 * This type is used in Comlink.transferHandlers.set('PHPResponse', \{ ... \})
 * so be sure to update that if you change this type.
 */
export class PHPResponse implements PHPResponseData {
	/** @inheritDoc */
	readonly headers: Record<string, string[]>;

	/** @inheritDoc */
	readonly bytes: ArrayBuffer;

	/** @inheritDoc */
	readonly errors: string;

	/** @inheritDoc */
	readonly exitCode: number;

	/** @inheritDoc */
	readonly httpStatusCode: number;

	constructor(
		httpStatusCode: number,
		headers: Record<string, string[]>,
		body: ArrayBuffer,
		errors = '',
		exitCode = 0
	) {
		this.httpStatusCode = httpStatusCode;
		this.headers = headers;
		this.bytes = body;
		this.exitCode = exitCode;
		this.errors = errors;
	}

	static forHttpCode(httpStatusCode: number, text = '') {
		return new PHPResponse(
			httpStatusCode,
			{},
			new TextEncoder().encode(
				text || responseTexts[httpStatusCode] || ''
			)
		);
	}

	static fromRawData(data: PHPResponseData): PHPResponse {
		return new PHPResponse(
			data.httpStatusCode,
			data.headers,
			data.bytes,
			data.errors,
			data.exitCode
		);
	}

	static async fromStreamedResponse(
		streamedResponse: StreamedPHPResponse
	): Promise<PHPResponse> {
		await streamedResponse.finished;
		return new PHPResponse(
			await streamedResponse.httpStatusCode,
			await streamedResponse.headers,
			new TextEncoder().encode(await streamedResponse.stdoutText),
			await streamedResponse.stderrText,
			await streamedResponse.exitCode
		);
	}

	toRawData(): PHPResponseData {
		return {
			headers: this.headers,
			bytes: this.bytes,
			errors: this.errors,
			exitCode: this.exitCode,
			httpStatusCode: this.httpStatusCode,
		};
	}

	/**
	 * Response body as JSON.
	 */
	get json() {
		return JSON.parse(this.text);
	}

	/**
	 * Response body as text.
	 */
	get text() {
		return new TextDecoder().decode(this.bytes);
	}
}
