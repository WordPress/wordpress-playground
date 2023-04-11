/**
 * PHP response. Body is an `ArrayBuffer` because it can
 * contain binary data.
 */
export class PHPResponse {
	/**
	 * Response headers.
	 */
	readonly headers: Record<string, string[]>;
	/**
	 * Response body. Contains the output from `echo`,
	 * `print`, inline HTML etc.
	 */
	private readonly body: ArrayBuffer;
	/**
	 * PHP errors.
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

	constructor(
		httpStatusCode: number,
		headers: Record<string, string[]>,
		body: ArrayBuffer,
		errors = '',
		exitCode = 0
	) {
		this.httpStatusCode = httpStatusCode;
		this.headers = headers;
		this.body = body;
		this.exitCode = exitCode;
		this.errors = errors;
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
		return new TextDecoder().decode(this.body);
	}

	/**
	 * Response body as bytes.
	 */
	get bytes() {
		return this.body;
	}
}
