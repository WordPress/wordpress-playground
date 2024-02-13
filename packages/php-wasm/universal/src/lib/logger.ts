import { UniversalPHP } from "./universal-php";

export enum LogSeverity {
    // A dine grained debugging event. Typically disabled in default configurations.
    Trace = 1,
    // A debugging event.
    Debug = 5,
    // An informational event. Indicates that an event happened.
    Info = 9,
    // A warning event. Not an error but is likely more important than an informational event.
    Warn = 13,
    // An error event. Something went wrong.
    Error = 17,
    // A fatal error such as application or system crash.
    Fatal = 21,
}

export type Log = {
    // Time when the event occurred.
    timestamp: number;
    // Time when the event was observed.
    observedTimestamp: number;
    // Request trace id.
    traceId: number;
    // Request span id.
    spanId: number; // Not implemented
    // W3C trace flag.
    traceFlags: number;
    // The severity text (also known as log level).
    severityText: string;
    // Numerical value of the severity.
    severityNumber: LogSeverity;
    // The body of the log record.
    body: string;
    // Describes the source of the log.
    resource: string;
    // Describes the scope that emitted the log.
    instrumentationScope: string; // Not implemented
    // Additional information about the event.
    attributes: Record<string, string>;
};

export class Logger {
    private php: UniversalPHP | undefined;
    private logs: Log[] = [];
    private wordpressLogs: string[] | undefined = undefined;

    constructor(php?: UniversalPHP) {
        this.php = php;
        if (this.php) {
            this.php.addEventListener(
                'request.end',
                () => {
                    console.log(this.getLogs());
                }
            )
            this.php.onMessage((message) => {
                try {
                    const logMessage = JSON.parse(message);
                    if (logMessage.type === 'wordpress-log') {
                        this.log(
                            logMessage.body,
                            logMessage.severityNumber,
                            logMessage.timestamp,
                            'wordpress',
                        );
                    }
                } catch (error) {
                    // Not a log message
                }
            });
        }
        if ( typeof window !== 'undefined' ) {
            window.onerror = (message, source, lineno, colno) => {
                this.log(
                    `${message} in ${source} on line ${lineno}:${colno}`,
                    LogSeverity.Fatal,
                    Date.now(),
                    'javascript',
                );
            }
        }
    }

    public log(body: string, severityNumber: LogSeverity = LogSeverity.Info, timestamp?: number, resource = 'php', instrumentationScope = 'php', attributes: Record<string, string> = {}): void {
        const now = Date.now();
        this.logs.push({
            timestamp: timestamp || now,
            observedTimestamp: now,
            traceId: 1, // @TODO: Implement trace id
            spanId: 1, // @TODO: Implement span id
            traceFlags: 1,
            severityText: LogSeverity[severityNumber],
            severityNumber,
            body,
            resource,
            instrumentationScope,
            attributes,
        });
    }

    public getLogs(): Log[] {
        return this.logs;
    }

    public async addWordPressLogs() {
        if (this.php && this.wordpressLogs === undefined) {
            const rawLogs =  await this.php.readFileAsText('/tmp/debug.log');
        }
    }

};

let logger: Logger | undefined = undefined;

export function get_logger(php?: BasePHP): Logger {
    if (!logger) {
        logger = new Logger(php);
    }
    return logger;
}