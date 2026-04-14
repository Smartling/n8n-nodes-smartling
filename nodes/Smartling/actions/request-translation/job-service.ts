import { smartlingRequest } from "../../common/smartling-api";
import { FileType } from "../../common/files";

export const DAILY_JOB_NAME_TEMPLATE = "[{prefix}] Daily bucket job for n8n content {yyyy-MM-dd}";
export const DAILY_JOB_TZ = "UTC";

export type DailyJobType = "dailyJob" | "customDailyJob";

interface BuildJobNameArgs {
    jobType: DailyJobType;
    jobNamePrefix?: string;
}

export interface RetrieveJobInput {
    projectUid: string;
    jobType: DailyJobType;
    jobNamePrefix?: string;
    referenceNumber?: string;
    targetLocalesIds: string[];
}

export interface AddFileToJobInput {
    projectUid: string;
    translationJobUid: string;
    authorize: boolean;
    fileUri: string;
    workflowUid?: string;
    targetLocalesIds: string[];
    fileContent: Buffer;
    fileType: FileType;
}

export const buildJobName = (input: BuildJobNameArgs): string => {
    const { jobType, jobNamePrefix } = input;
    const prefix = jobNamePrefix?.trim();

    if (jobType === "customDailyJob" && prefix) {
        return DAILY_JOB_NAME_TEMPLATE.replace("{prefix}", prefix);
    }

    return DAILY_JOB_NAME_TEMPLATE.replace(/^\[\{prefix\}\]\s*/, "");
};

export const retrieveJob = async (
    context: any,
    input: RetrieveJobInput
) => {
    const {
        projectUid,
        jobType,
        jobNamePrefix,
        referenceNumber,
        targetLocalesIds
    } = input;
    const jobName = buildJobName({ jobType, jobNamePrefix });

    const createdJob = await smartlingRequest(context, {
        method: "POST",
        path: `/job-batches-api/v2/projects/${projectUid}/jobs`,
        body: {
            nameTemplate: jobName,
            mode: "REUSE_EXISTING",
            targetLocaleIds: targetLocalesIds,
            timeZoneName: DAILY_JOB_TZ,
        },
    });

    const {
        translationJobUid,
        jobName: actualName
    } = createdJob;

    if (jobType === "customDailyJob" && referenceNumber) {
        await smartlingRequest(context, {
            method: "PUT",
            path: `/jobs-api/v3/projects/${projectUid}/jobs/${translationJobUid}`,
            body: {
                name: actualName,
                referenceNumber,
            },
        });
    }

    return createdJob;
};

export const addFileToJob = async (
    context: any,
    input: AddFileToJobInput
) => {
    const {
        projectUid,
        translationJobUid,
        authorize,
        fileUri,
        workflowUid,
        targetLocalesIds,
        fileType,
        fileContent
    } = input;

    const localeWorkflows: Array<{ targetLocaleId: string; workflowUid: string }> = [];
    if (authorize && workflowUid) {
        targetLocalesIds.forEach(localeId => {
            localeWorkflows.push({ targetLocaleId: localeId, workflowUid });
        });
    }

    const batch = await smartlingRequest(context, {
        method: "POST",
        path: `/job-batches-api/v2/projects/${projectUid}/batches`,
        body: {
            translationJobUid,
            authorize,
            fileUris: [fileUri],
            localeWorkflows,
        },
    });

    const { batchUid } = batch;

    // Build multipart body for file upload
    const boundary = "----n8nSmartlingBoundary" + Date.now().toString(36);

    const parts: Buffer[] = [];

    // fileUri field
    parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="fileUri"\r\n\r\n${fileUri}\r\n`
    ));

    // fileType field
    parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="fileType"\r\n\r\n${fileType}\r\n`
    ));

    // localeIdsToAuthorize[] fields
    for (const localeId of targetLocalesIds) {
        parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="localeIdsToAuthorize[]"\r\n\r\n${localeId}\r\n`
        ));
    }

    // file field
    parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileUri}"\r\nContent-Type: application/octet-stream\r\n\r\n`
    ));
    parts.push(fileContent);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    await smartlingRequest(context, {
        method: "POST",
        path: `/job-batches-api/v2/projects/${projectUid}/batches/${batchUid}/file`,
        body,
        headers: {
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
    });

    // Check batch status once (no polling)
    const result = await smartlingRequest(context, {
        method: "GET",
        path: `/job-batches-api/v2/projects/${projectUid}/batches/${batchUid}`,
    });

    if (!result.files?.length) {
        throw new Error("Batch status returned no files.");
    }

    const fileStatus = result.files[0].status;

    if (fileStatus === "ATTACH_FAILED" || fileStatus === "UPLOAD_FAILED") {
        throw new Error(
            `File upload failed. Details: ${JSON.stringify(result.files[0].errors)}`
        );
    }

    // If still ATTACHING or UPLOADING, return as-is with batchUid for user to check later
    return { ...result, batchUid };
};
