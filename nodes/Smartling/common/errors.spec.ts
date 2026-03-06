import { wrapAndLogError } from "./errors";
import { Context } from "./context";
import type { INode } from "n8n-workflow";
import { NodeApiError, NodeOperationError } from "n8n-workflow";
import { SmartlingException } from "smartling-api-sdk-nodejs";

jest.mock("smartling-api-sdk-nodejs", () => {
    class SmartlingException extends Error {
        private payload: Record<string, unknown>;
        constructor(message: string, payload: Record<string, unknown> = {}) {
            super(message);
            this.name = "SmartlingException";
            this.payload = payload;
        }
        getPayload() {
            return this.payload;
        }
    }
    return {
        SmartlingException
    };
});

jest.mock("n8n-workflow", () => {
    class NodeApiError extends Error {
        httpCode: string | null;
        constructor(node: any, errorResponse: any, options?: any) {
            super(options?.message ?? errorResponse?.message ?? "API Error");
            this.name = "NodeApiError";
            this.httpCode = options?.httpCode ?? null;
        }
    }
    class NodeOperationError extends Error {
        constructor(node: any, messageOrError: any) {
            super(typeof messageOrError === "string" ? messageOrError : messageOrError?.message ?? "Operation Error");
            this.name = "NodeOperationError";
        }
    }
    return { NodeApiError, NodeOperationError };
});

describe("wrapAndLogError", () => {
    let mockCtx: Context;
    let mockNode: INode;

    beforeEach(() => {
        mockCtx = {
            logger: {
                error: jest.fn()
            }
        } as unknown as Context;

        mockNode = {
            id: "test-node-id",
            name: "Test Node",
            type: "n8n-nodes-smartling.smartling",
            typeVersion: 1,
            position: [0, 0],
            parameters: {}
        } as INode;
    });

    it("should wrap SmartlingException as NodeApiError", () => {
        const smartlingError = new SmartlingException("API failed");
        (smartlingError as any).payload = { statusCode: 400 };

        const result = wrapAndLogError(mockCtx, mockNode, smartlingError, "Operation failed");

        expect(result).toBeInstanceOf(NodeApiError);
        expect(result.name).toBe("NodeApiError");
    });

    it("should wrap generic errors as NodeOperationError", () => {
        const genericError = new Error("Something went wrong");

        const result = wrapAndLogError(mockCtx, mockNode, genericError, "Operation failed");

        expect(result).toBeInstanceOf(NodeOperationError);
        expect(result.name).toBe("NodeOperationError");
    });

    it("should log errors before wrapping", () => {
        const smartlingError = new SmartlingException("API failed");
        (smartlingError as any).payload = { statusCode: 500 };

        wrapAndLogError(mockCtx, mockNode, smartlingError, "Operation failed");

        expect(mockCtx.logger.error).toHaveBeenCalledTimes(1);
        expect(mockCtx.logger.error).toHaveBeenCalledWith(
            expect.stringContaining("Operation failed"),
            expect.objectContaining({
                error: expect.any(String)
            })
        );
    });

    it("should include error details in log context", () => {
        const genericError = new Error("Details here");
        const logContext = { projectId: "proj-123", fileUri: "test.json" };

        wrapAndLogError(mockCtx, mockNode, genericError, "Operation failed", logContext);

        expect(mockCtx.logger.error).toHaveBeenCalledWith(
            "Operation failed",
            expect.objectContaining({
                projectId: "proj-123",
                fileUri: "test.json",
                error: expect.any(String)
            })
        );
    });

    it("should log generic errors with context before wrapping", () => {
        const genericError = new Error("generic fail");

        wrapAndLogError(mockCtx, mockNode, genericError, "Something failed");

        expect(mockCtx.logger.error).toHaveBeenCalledTimes(1);
    });
});
