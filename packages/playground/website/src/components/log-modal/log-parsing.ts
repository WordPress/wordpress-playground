/**
 * The logger hands the website plain strings of two shapes: single
 * pre-formatted `[stamp] Prefix severity: message` entries, and whole
 * PHP debug.log chunks where one string carries many records (a single
 * WordPress database error can dump hundreds of lines). Parsing splits
 * chunks into records and reads each record's severity so the UI can
 * render one row per record instead of one unbounded wall of text. That
 * is all it does — the record text itself is displayed as logged.
 */

export type LogTier = 'error' | 'warning' | 'info';

export type LogEntry = {
	/**
	 * The record exactly as logged — the panel renders and copies this
	 * text verbatim. The fields below are read-only classifications of
	 * it; parsing never rewrites the record.
	 */
	raw: string;
	/** Full stamp, e.g. `20-Jul-2026 14:59:46 UTC`, when the record has one. */
	timestamp: string | null;
	/**
	 * The runtime that produced the record: PHP (the site, via debug.log)
	 * or Playground (the JavaScript host). Finer attribution — engine vs
	 * WordPress core vs plugin — is not recoverable from the log text.
	 */
	channel: string;
	/** Badge text, e.g. `E_WARNING`, `Database error`. */
	label: string;
	tier: LogTier;
};

/** Both PHP's debug.log and the JS logger stamp records as `[20-Jul-2026 …]`. */
const RECORD_BOUNDARY = /\n(?=\[\d{1,2}-[A-Za-z]{3}-\d{4} )/;
const TIMESTAMP_HEAD = /^\[(\d{1,2}-[A-Za-z]{3}-\d{4} [^\]]*)\]\s?/;

/** Heads written by the JS logger's formatLogEntry. */
const FORMATTED_HEAD =
	/^(PHP|JavaScript|Wasm Crash) (fatal|error|warn|log|info|debug):\s*/;
const FORMATTED_SEVERITIES: Record<string, { label: string; tier: LogTier }> = {
	fatal: { label: 'Fatal error', tier: 'error' },
	error: { label: 'Error', tier: 'error' },
	warn: { label: 'Warning', tier: 'warning' },
	log: { label: 'Log', tier: 'info' },
	info: { label: 'Info', tier: 'info' },
	debug: { label: 'Debug', tier: 'info' },
};

/**
 * Heads PHP itself writes to debug.log. The lazy word prefix covers the
 * compound levels — `Fatal error`, `Recoverable fatal error`, and the
 * like — without listing each one.
 */
const PHP_HEAD =
	/^PHP ((?:\w+ )*?(?:error|warning|notice|deprecated|strict standards)):\s*/i;

/**
 * debug.log heads restored to the constant names developers configure in
 * error_reporting. PHP prints the same string for the E_USER_* and E_CORE_*
 * variants, so the base constant is as precise as the log text allows.
 * Unlisted heads keep their verbatim text.
 */
const PHP_LEVELS: Record<string, { label: string; tier: LogTier }> = {
	'fatal error': { label: 'E_ERROR', tier: 'error' },
	'recoverable fatal error': { label: 'E_RECOVERABLE_ERROR', tier: 'error' },
	'parse error': { label: 'E_PARSE', tier: 'error' },
	warning: { label: 'E_WARNING', tier: 'warning' },
	deprecated: { label: 'E_DEPRECATED', tier: 'warning' },
	notice: { label: 'E_NOTICE', tier: 'info' },
	'strict standards': { label: 'E_STRICT', tier: 'info' },
};

const DATABASE_HEAD = /^WordPress database error\s*/;

export function parseLogs(rawLogs: string[]): LogEntry[] {
	return rawLogs.flatMap((rawLog) =>
		rawLog
			.split(RECORD_BOUNDARY)
			.map((record) => record.trim())
			.filter((record) => record !== '')
			.map(parseLogRecord)
	);
}

function parseLogRecord(record: string): LogEntry {
	// The heads below are matched only to classify the record; `body` is
	// never returned. The stamp is sliced off solely so the `^`-anchored
	// head patterns can see past it.
	let body = record;
	let timestamp: string | null = null;
	const stampMatch = body.match(TIMESTAMP_HEAD);
	if (stampMatch) {
		timestamp = stampMatch[1];
		body = body.slice(stampMatch[0].length);
	}

	const formattedMatch = body.match(FORMATTED_HEAD);
	if (formattedMatch) {
		const severity = FORMATTED_SEVERITIES[formattedMatch[2]];
		const isWasmCrash = formattedMatch[1] === 'Wasm Crash';
		return {
			raw: record,
			timestamp,
			channel: formattedMatch[1] === 'PHP' ? 'PHP' : 'Playground',
			label: isWasmCrash ? 'Crash' : severity.label,
			tier: isWasmCrash ? 'error' : severity.tier,
		};
	}

	if (DATABASE_HEAD.test(body)) {
		return {
			raw: record,
			timestamp,
			channel: 'PHP',
			label: 'Database error',
			tier: 'error',
		};
	}

	const phpMatch = body.match(PHP_HEAD);
	if (phpMatch) {
		const level = PHP_LEVELS[phpMatch[1].toLowerCase()];
		return {
			raw: record,
			timestamp,
			channel: 'PHP',
			label: level?.label ?? phpMatch[1],
			tier: level?.tier ?? phpTier(phpMatch[1]),
		};
	}

	// error_log() output carries no severity head, only the debug.log stamp.
	return {
		raw: record,
		timestamp,
		channel: 'PHP',
		label: 'Log',
		tier: 'info',
	};
}

function phpTier(label: string): LogTier {
	const level = label.toLowerCase();
	if (level.endsWith('error')) {
		return 'error';
	}
	if (level.endsWith('warning') || level.endsWith('deprecated')) {
		return 'warning';
	}
	return 'info';
}
