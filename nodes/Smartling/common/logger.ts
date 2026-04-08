import { randomUUID } from "crypto";

type LogContext = Record<string, unknown>;

export class RemoteLogger {
    private readonly commonContext: LogContext;

    constructor(
        actionName: string,
        contextOverrides: Record<string, unknown>,
        version: string
    ) {
        this.commonContext = {
            requestId: randomUUID(),
            host: "n8n",
            moduleVersion: version,
            action: actionName,
            ...contextOverrides
        };
    }

    public debug(message: string, context?: LogContext) {
        console.debug(this.getMessage(message, context));
    }

    public info(message: string, context?: LogContext) {
        console.info(this.getMessage(message, context));
    }

    public warn(message: string, context?: LogContext) {
        console.warn(this.getMessage(message, context));
    }

    public error(message: string, context?: LogContext) {
        console.error(this.getMessage(message, context));
    }

    public async flush() {
        // No-op: stdout doesn't need flushing
    }

    public getRequestId() {
        return this.commonContext.requestId as string;
    }

    public setRequestId(requestId: string) {
        this.commonContext.requestId = requestId;
    }

    public setContextValue(key: string, value: unknown) {
        this.commonContext[key] = value;
    }

    public getContextValue(key: string): unknown {
        return this.commonContext[key];
    }

    private getMessage(message: string, context?: LogContext) {
        const contextString = context ? ` ${JSON.stringify(context)}` : "";
        return `${message}${contextString}`;
    }
}
