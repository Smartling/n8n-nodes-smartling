import { randomUUID } from "crypto";
import { CreateLogParameters, LogLevel, SmartlingLogApi } from "@smartling/api-sdk-nodejs-internal";
import { REMOTE_LOGGER_CHANNEL, REMOTE_LOGGER_HOST } from "./constants";

type LogContext = Record<string, unknown>;

export class RemoteLogger {
    private readonly commonContext: LogContext;

    private logBuffer: CreateLogParameters;

    constructor(
        private readonly logApi: SmartlingLogApi,
        actionName: string,
        contextOverrides: Record<string, unknown>,
        version: string
    ) {
        this.commonContext = {
            requestId: randomUUID(),
            host: REMOTE_LOGGER_HOST,
            moduleVersion: version,
            action: actionName,
            ...contextOverrides
        };
        this.logBuffer = new CreateLogParameters();
    }

    public debug(message: string, context?: LogContext) {
        this.addLogEntry(LogLevel.DEBUG, message, context);
        console.debug(this.getMessage(message, context));
    }

    public info(message: string, context?: LogContext) {
        this.addLogEntry(LogLevel.INFO, message, context);
        console.info(this.getMessage(message, context));
    }

    public warn(message: string, context?: LogContext) {
        this.addLogEntry(LogLevel.WARNING, message, context);
        console.warn(this.getMessage(message, context));
    }

    public error(message: string, context?: LogContext) {
        this.addLogEntry(LogLevel.ERROR, message, context);
        console.error(this.getMessage(message, context));
    }

    public async flush() {
        if (Object.keys(this.logBuffer.export() ?? {}).length) {
            await this.logApi.log(this.logBuffer);
            this.logBuffer = new CreateLogParameters();
        }
    }

    public getRequestId() {
        return this.commonContext.requestId;
    }

    public setRequestId(requestId: string) {
        this.commonContext.requestId = requestId;
    }

    private addLogEntry(level: LogLevel, message: string, context?: LogContext) {
        const finalContext = {
            ...this.commonContext,
            ...context
        };
        const serializedContext = this.serializeContext(finalContext);
        this.logBuffer.addLogRecord(message, serializedContext, level, REMOTE_LOGGER_CHANNEL, new Date());
    }

    private serializeContext(context: LogContext): LogContext {
        const serialized: LogContext = {};
        for (const [key, value] of Object.entries(context)) {
            if (value === null || value === undefined) {
                serialized[key] = value;
            } else if (typeof value === "object") {
                try {
                    serialized[key] = JSON.stringify(value);
                } catch (e) {
                    serialized[key] = String(value);
                }
            } else {
                serialized[key] = value;
            }
        }
        return serialized;
    }

    private getMessage(message: string, context?: LogContext) {
        const contextString = context ? ` ${JSON.stringify(context)}` : "";
        return `${message}${contextString}`;
    }
}
