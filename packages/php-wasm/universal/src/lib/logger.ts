import { BasePHP } from "./base-php";
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

// Log format based on OpenTelemetry https://opentelemetry.io/docs/specs/otel/logs/data-model/
export type Log = {
    // Time when the event occurred.
    timestamp?: number;
    // Time when the event was observed.
    observedTimestamp?: number;
    // Request trace id.
    traceId?: number;
    // Request span id.
    spanId?: number; // Not implemented
    // W3C trace flag.
    traceFlags?: number;
    // The severity text (also known as log level).
    severityText?: string;
    // Numerical value of the severity.
    severityNumber: LogSeverity;
    // The body of the log record.
    body: string;
    // Describes the source of the log.
    resource?: string;
    // Describes the scope that emitted the log.
    instrumentationScope?: string; // Not implemented
    // Additional information about the event.
    attributes?: Record<string, string>;
};

const defaultLog: Log = {
    timestamp: 0,
    observedTimestamp: 0,
    traceId: 0,
    spanId: 0,
    traceFlags: 0,
    severityText: LogSeverity[LogSeverity.Info],
    severityNumber: LogSeverity.Info,
    body: '',
    resource: '',
    instrumentationScope: '',
    attributes: {},
};

export class Logger {
    private php: UniversalPHP | undefined;
    private logs: Log[] = [];

    constructor(php?: UniversalPHP) {
        this.php = php;
        if (this.php) {
            console.log('Logger: PHP is available');
            this.php.addEventListener(
                'request.end',
                () => {
                    this.printWordPressLogs();
                }
            )
            this.php.onMessage(this.processPhpLogMessage.bind(this));
        }
        if ( typeof window !== 'undefined' ) {
            window.onerror = (message, source, lineno, colno) => {
                this.log({
                    body: `${message} in ${source} on line ${lineno}:${colno}`,
                    severityNumber: LogSeverity.Fatal,
                    resource: 'javascript',
                });
            }
        }
    }

    private processPhpLogMessage(message: string) {
        try {
            const logMessage = JSON.parse(message);
            if (logMessage.type === 'wordpress-log') {
                this.log({
                   ...logMessage,
                   severityNumber: LogSeverity[logMessage.severityText as keyof typeof LogSeverity],
                    resource: 'wordpress',
                });
            }
        } catch (error) {
            // Not a log message
        }
    }

    public log(rawLog: Log): void {
        const now = Date.now();
        const log = {
            ...defaultLog,
            ...rawLog,
        };
        log.timestamp = log.timestamp || now;
        log.observedTimestamp = now;
        log.severityText = LogSeverity[log.severityNumber];

        this.logs.push(log);
        console.log(log);
    }

    public getLogs(): Log[] {
        return this.logs;
    }

    public async printWordPressLogs() {
        if (!this.php) {
            return;
        }
        const logPath = `/tmp/debug.log`;
        if (await this.php.fileExists(logPath)) {
            const rawLogs =  await this.php.readFileAsText(logPath);
            console.log(rawLogs);
        } else {
            console.log('No logs found');
        }
    }

};

let logger: Logger | undefined = undefined;

export function get_logger(php?: UniversalPHP | BasePHP): Logger {
    if (!logger) {
        logger = new Logger(php as UniversalPHP);
    }
    return logger;
}