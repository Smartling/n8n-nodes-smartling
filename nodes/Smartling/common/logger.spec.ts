import { RemoteLogger } from "./logger";
import { CreateLogParameters, LogLevel, SmartlingLogApi } from "@smartling/api-sdk-nodejs-internal";

jest.mock("@smartling/api-sdk-nodejs-internal", () => {
    const mockExport = jest.fn().mockReturnValue({ records: ["entry"] });
    const mockAddLogRecord = jest.fn();

    return {
        LogLevel: {
            DEBUG: "DEBUG",
            INFO: "INFO",
            WARNING: "WARNING",
            ERROR: "ERROR"
        },
        CreateLogParameters: jest.fn().mockImplementation(() => ({
            export: mockExport,
            addLogRecord: mockAddLogRecord
        })),
        SmartlingLogApi: jest.fn()
    };
});

describe("RemoteLogger", () => {
    let mockLogApi: jest.Mocked<SmartlingLogApi>;
    let logger: RemoteLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogApi = {
            log: jest.fn().mockResolvedValue(undefined)
        } as any;
        logger = new RemoteLogger(mockLogApi, "testAction", { accountUid: "test-account" }, "1.0.0");
    });

    it("should buffer log entries and flush to API", async () => {
        logger.info("test message");

        await logger.flush();

        expect(mockLogApi.log).toHaveBeenCalledTimes(1);
        expect(mockLogApi.log).toHaveBeenCalledWith(expect.objectContaining({
            addLogRecord: expect.any(Function)
        }));
    });

    it("should not call API when buffer is empty", async () => {
        // Create a logger where the buffer export returns empty
        const emptyLogger = new RemoteLogger(mockLogApi, "testAction", {}, "1.0.0");

        // Override the buffer to return empty
        const buffer = (emptyLogger as any).logBuffer;
        buffer.export = jest.fn().mockReturnValue({});

        await emptyLogger.flush();

        expect(mockLogApi.log).not.toHaveBeenCalled();
    });

    it("should generate unique request IDs", () => {
        const logger2 = new RemoteLogger(mockLogApi, "testAction", {}, "1.0.0");

        const requestId1 = logger.getRequestId();
        const requestId2 = logger2.getRequestId();

        expect(requestId1).toBeDefined();
        expect(requestId2).toBeDefined();
        expect(requestId1).not.toEqual(requestId2);
    });

    it("should support all log levels (debug, info, warn, error)", () => {
        const consoleSpy = {
            debug: jest.spyOn(console, "debug").mockImplementation(),
            info: jest.spyOn(console, "info").mockImplementation(),
            warn: jest.spyOn(console, "warn").mockImplementation(),
            error: jest.spyOn(console, "error").mockImplementation()
        };

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(consoleSpy.debug).toHaveBeenCalledWith("debug message");
        expect(consoleSpy.info).toHaveBeenCalledWith("info message");
        expect(consoleSpy.warn).toHaveBeenCalledWith("warn message");
        expect(consoleSpy.error).toHaveBeenCalledWith("error message");

        Object.values(consoleSpy).forEach(spy => spy.mockRestore());
    });

    it("should serialize context objects", () => {
        const consoleSpy = jest.spyOn(console, "info").mockImplementation();

        const context = { nested: { key: "value" }, simple: "text" };
        logger.info("message with context", context);

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining("message with context")
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(JSON.stringify(context))
        );

        consoleSpy.mockRestore();
    });

    it("should support setRequestId", () => {
        const newRequestId = "custom-request-id";
        logger.setRequestId(newRequestId);

        expect(logger.getRequestId()).toBe(newRequestId);
    });
});
