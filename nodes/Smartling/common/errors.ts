import { SmartlingException } from "smartling-api-sdk-nodejs";
import { NodeApiError, NodeOperationError } from "n8n-workflow";
import type { INode } from "n8n-workflow";
import { Context } from "./context";

const RESOURCE_LOCKED_ERROR_CODE = 423;
const MAX_OPERATIONS_LIMIT_EXCEEDED_ERROR_CODE = 429;

const isErrorRequiresRetry = (
    payload: Record<string, unknown>
): boolean => (payload?.statusCode === MAX_OPERATIONS_LIMIT_EXCEEDED_ERROR_CODE)
        || (payload?.statusCode === RESOURCE_LOCKED_ERROR_CODE);

const handleSmartlingError = (
    ctx: Context,
    node: INode,
    error: SmartlingException,
    errorMessage: string,
    logContext?: Record<string, unknown>
) => {
    const payload = error.getPayload();
    const message = `${errorMessage} ${error.message}`;
    ctx.logger.error(
        message,
        {
            ...logContext,
            error: JSON.stringify(payload)
        }
    );

    const httpCode = isErrorRequiresRetry(payload)
        ? String(payload.statusCode)
        : undefined;

    return new NodeApiError(node, { message }, { message, httpCode });
};

export const wrapAndLogError = (
    ctx: Context,
    node: INode,
    error: any,
    errorMessage: string,
    logContext?: Record<string, unknown>
): Error => {
    if (error instanceof SmartlingException) {
        return handleSmartlingError(ctx, node, error, errorMessage, logContext);
    }

    ctx.logger.error(
        errorMessage,
        {
            ...logContext,
            error: JSON.stringify(error)
        }
    );

    return new NodeOperationError(node, errorMessage);
};
