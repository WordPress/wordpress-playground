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
	readonly headers: Promise<Record<string, string[]>>;

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
	 * The exit code of the script. `0` is a success, while
	 * `1` and `2` indicate an error.
	 */
	readonly exitCode: Promise<number>;

	/**
	 * Response HTTP status code, e.g. 200.
	 */
	readonly httpStatusCode: Promise<number>;

	constructor(
		headers: Promise<Record<string, string[]>>,
		stdout: ReadableStream<Uint8Array>,
		stderr: ReadableStream<Uint8Array>,
		exitCode: Promise<number>,
		httpStatusCode: Promise<number>
	) {
		this.headers = headers;
		this.stdout = stdout;
		this.stderr = stderr;
		this.exitCode = exitCode;
		this.httpStatusCode = httpStatusCode;
	}

	get stdoutText(): Promise<string> {
		return streamToText(this.stdout);
	}

	get stderrText(): Promise<string> {
		return streamToText(this.stderr);
	}
}

function streamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
	return new Promise(async (resolve) => {
		const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
		const text: string[] = [];
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
