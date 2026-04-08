import { RemoteLogger } from "./logger";

describe("RemoteLogger", () => {
    let logger: RemoteLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "debug").mockImplementation();
        jest.spyOn(console, "info").mockImplementation();
        jest.spyOn(console, "warn").mockImplementation();
        jest.spyOn(console, "error").mockImplementation();
        logger = new RemoteLogger("test-action", {}, "1.0.0");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should log debug messages to stdout", () => {
        logger.debug("test message");
        expect(console.debug).toHaveBeenCalledWith("test message");
    });

    it("should log info messages to stdout", () => {
        logger.info("test message");
        expect(console.info).toHaveBeenCalledWith("test message");
    });

    it("should log warn messages to stdout", () => {
        logger.warn("test message");
        expect(console.warn).toHaveBeenCalledWith("test message");
    });

    it("should log error messages to stdout", () => {
        logger.error("test message");
        expect(console.error).toHaveBeenCalledWith("test message");
    });

    it("should include context in log messages", () => {
        logger.info("test message", { key: "value" });
        expect(console.info).toHaveBeenCalledWith('test message {"key":"value"}');
    });

    it("should generate a request ID", () => {
        expect(logger.getRequestId()).toBeDefined();
        expect(typeof logger.getRequestId()).toBe("string");
    });

    it("should allow setting and getting request ID", () => {
        logger.setRequestId("custom-id");
        expect(logger.getRequestId()).toBe("custom-id");
    });

    it("should allow setting and getting context values", () => {
        logger.setContextValue("accountUid", "acc-123");
        expect(logger.getContextValue("accountUid")).toBe("acc-123");
    });

    it("should flush without error", async () => {
        await expect(logger.flush()).resolves.toBeUndefined();
    });
});
