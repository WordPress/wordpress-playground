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
	readonly bytes: Uint8Array;

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
	 * Response headers stream (internal).
	 */
	readonly #headersStream: ReadableStream<Uint8Array>;

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

	private cachedStdoutBytes: Promise<Uint8Array> | null = null;
	private cachedStderrText: Promise<string> | null = null;

	constructor(
		headers: ReadableStream<Uint8Array>,
		stdout: ReadableStream<Uint8Array>,
		stderr: ReadableStream<Uint8Array>,
		exitCode: Promise<number>
	) {
		this.#headersStream = headers;
		this.stdout = stdout;
		this.stderr = stderr;
		this.exitCode = exitCode;
	}

	/**
	 * Creates a StreamedPHPResponse from a buffered PHPResponse.
	 * Useful for unifying response handling when both types may be returned.
	 */
	static fromPHPResponse(response: PHPResponse): StreamedPHPResponse {
		// Create a ReadableStream containing the response bytes
		const stdout = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(response.bytes);
				controller.close();
			},
		});

		// Create empty streams for headers and stderr (won't be used since
		// we set parsedHeaders directly below)
		const emptyStream = () =>
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.close();
				},
			});

		const streamed = new StreamedPHPResponse(
			emptyStream(),
			stdout,
			emptyStream(),
			Promise.resolve(response.exitCode)
		);

		// Set pre-parsed headers to bypass header stream parsing
		streamed.parsedHeaders = Promise.resolve({
			headers: response.headers,
			httpStatusCode: response.httpStatusCode,
		});

		return streamed;
	}

	/**
	 * Creates a StreamedPHPResponse for a given HTTP status code.
	 * Shorthand for `StreamedPHPResponse.fromPHPResponse(PHPResponse.forHttpCode(...))`.
	 */
	static forHttpCode(httpStatusCode: number, text = ''): StreamedPHPResponse {
		return StreamedPHPResponse.fromPHPResponse(
			PHPResponse.forHttpCode(httpStatusCode, text)
		);
	}

	/**
	 * Returns the raw headers stream for serialization purposes.
	 * For parsed headers, use the `headers` property instead.
	 */
	getHeadersStream(): ReadableStream<Uint8Array> {
		return this.#headersStream;
	}

	/**
	 * True if the response is successful (HTTP status code 200-399),
	 * false otherwise.
	 */
	async ok(): Promise<boolean> {
		try {
			const statusCode = await this.httpStatusCode;
			return statusCode >= 200 && statusCode < 400;
		} catch {
			return false;
		}
	}

	/**
	 * Resolves when the response has finished processing – either successfully or not.
	 */
	get finished(): Promise<void> {
		return Promise.allSettled([this.exitCode.finally(() => {})]).then(
			() => {}
		);
	}

	/**
	 * Resolves once HTTP headers are available.
	 */
	get headers(): Promise<Record<string, string[]>> {
		return this.getParsedHeaders().then((headers) => headers.headers);
	}

	/**
	 * Resolves once HTTP status code is available.
	 */
	get httpStatusCode(): Promise<number> {
		return this.getParsedHeaders()
			.then((headers) => headers.httpStatusCode)
			.then((result) => {
				if (result !== undefined) {
					return result;
				}
				// If exit code is 0 or not available yet, fall back to parsed headers
				return this.getParsedHeaders().then(
					(headers) => headers.httpStatusCode,
					() => 200
				);
			})
			.catch(() => 500);
	}

	/**
	 * Exposes the stdout bytes as they're produced by the PHP instance
	 */
	get stdoutText(): Promise<string> {
		return this.stdoutBytes.then((bytes) =>
			new TextDecoder().decode(bytes)
		);
	}

	/**
	 * Exposes the stdout bytes as they're produced by the PHP instance
	 */
	get stdoutBytes(): Promise<Uint8Array> {
		if (!this.cachedStdoutBytes) {
			this.cachedStdoutBytes = streamToBytes(this.stdout);
		}
		return this.cachedStdoutBytes;
	}

	/**
	 * Exposes the stderr bytes as they're produced by the PHP instance
	 */
	get stderrText(): Promise<string> {
		if (!this.cachedStderrText) {
			this.cachedStderrText = streamToText(this.stderr);
		}
		return this.cachedStderrText;
	}

	private async getParsedHeaders() {
		if (!this.parsedHeaders) {
			this.parsedHeaders = parseHeadersStream(this.#headersStream);
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
	} catch {
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

async function streamToText(
	stream: ReadableStream<Uint8Array>
): Promise<string> {
	const reader = (stream as ReadableStream<BufferSource>)
		.pipeThrough(new TextDecoderStream())
		.getReader();
	const text: string[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			return text.join('');
		}
		if (value) {
			text.push(value);
		}
	}
}

async function streamToBytes(
	stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			const totalLength = chunks.reduce(
				(acc, chunk) => acc + chunk.byteLength,
				0
			);
			const result = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				result.set(chunk, offset);
				offset += chunk.byteLength;
			}
			return result;
		}
		if (value) {
			chunks.push(value);
		}
	}
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
	readonly bytes: Uint8Array;

	/** @inheritDoc */
	readonly errors: string;

	/** @inheritDoc */
	readonly exitCode: number;

	/** @inheritDoc */
	readonly httpStatusCode: number;

	constructor(
		httpStatusCode: number,
		headers: Record<string, string[]>,
		body: Uint8Array,
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
			await streamedResponse.stdoutBytes,
			await streamedResponse.stderrText,
			await streamedResponse.exitCode
		);
	}

	/**
	 * True if the response is successful (HTTP status code 200-399),
	 * false otherwise.
	 */
	ok(): boolean {
		return this.httpStatusCode >= 200 && this.httpStatusCode < 400;
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
