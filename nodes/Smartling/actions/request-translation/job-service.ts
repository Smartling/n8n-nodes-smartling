import {
    BatchItemStatus,
    CreateBatchParameters,
    FileType as SdkFileType,
    JobBatchesParameters,
    JobBatchesParametersMode,
    UpdateJobParameters,
    UploadBatchFileParameters
} from "smartling-api-sdk-nodejs";
import { pollUntil } from "../../common/utils";
import { FileType } from "../../common/files";
import { Context } from "../../common/context";

export const DAILY_JOB_NAME_TEMPLATE = "[{prefix}] Daily bucket job for n8n content {yyyy-MM-dd}";
export const DAILY_JOB_TZ = "UTC";
export const BATCH_STATUS_POLLING_INITIAL_DELAY = 1000;
export const BATCH_STATUS_POLLING_INTERVAL = 3000;
export const DEFAULT_MAX_POLL_DURATION = 300_000;

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
    startTime: number;
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
    ctx: Context,
    input: RetrieveJobInput
) => {
    const {
        projectUid,
        jobType,
        jobNamePrefix,
        referenceNumber,
        targetLocalesIds
    } = input;
    const jobBatchesApi = ctx.getJobBatchesApi();
    const jobsApi = ctx.getJobsApi();
    const jobName = buildJobName({ jobType, jobNamePrefix });

    ctx.logger.debug(`Creating/reusing daily job. jobName="${jobName}"`);

    const createdJob = await jobBatchesApi.createJob(
        projectUid,
        jobName,
        new JobBatchesParameters()
            .setMode(JobBatchesParametersMode.REUSE_EXISTING)
            .setTargetLocaleIds(targetLocalesIds)
            .setTimeZoneName(DAILY_JOB_TZ)
    );

    const {
        translationJobUid,
        jobName: actualName
    } = createdJob;

    if (jobType === "customDailyJob" && referenceNumber) {
        await jobsApi.updateJob(
            projectUid,
            translationJobUid,
            new UpdateJobParameters()
                .setName(actualName)
                .setReferenceNumber(referenceNumber)
        );
    }

    ctx.logger.debug(`Created/reused daily job. jobName="${jobName}", actualJobName=${actualName}, translationJobUid=${translationJobUid}`);

    return createdJob;
};

export const addFileToJob = async (
    ctx: Context,
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
        fileContent,
        startTime
    } = input;

    const params = new CreateBatchParameters()
        .setTranslationJobUid(translationJobUid)
        .setAuthorize(authorize)
        .addFileUri(fileUri);

    if (authorize && workflowUid) {
        targetLocalesIds.forEach(localeId => {
            params.addLocaleWorkflows(localeId, workflowUid);
        });
    }

    const jobBatchesApi = ctx.getJobBatchesApi();

    ctx.logger.debug(`Creating job batch. translationJobUid="${translationJobUid}"`);
    const batch = await jobBatchesApi.createBatch(
        projectUid,
        params
    );
    const { batchUid } = batch;
    ctx.logger.debug(`Created job batch. translationJobUid="${translationJobUid}" batchUid="${batchUid}"`);

    ctx.logger.debug(`Adding file to the batch. translationJobUid="${translationJobUid}" batchUid="${batchUid}" fileUri="${fileUri}"`);

    await jobBatchesApi.uploadBatchFile(
        projectUid,
        batchUid,
        new UploadBatchFileParameters()
            .setFileUri(fileUri)
            .setFileType(fileType as unknown as SdkFileType)
            .setLocalesToApprove(targetLocalesIds)
            .setFileContent(fileContent as unknown as string)
    );
    ctx.logger.debug(`Added file to the batch. translationJobUid="${translationJobUid}" batchUid="${batchUid}" fileUri="${fileUri}"`);

    ctx.logger.debug(`Getting batch status. translationJobUid="${translationJobUid}" batchUid="${batchUid}" fileUri="${fileUri}"`);

    const elapsed = Date.now() - startTime;
    const maxDuration = DEFAULT_MAX_POLL_DURATION - elapsed;

    const result = await pollUntil(
        async () => jobBatchesApi.getBatchStatus(projectUid, batchUid),
        {
            initialDelay: BATCH_STATUS_POLLING_INITIAL_DELAY,
            delayBetweenAttempts: BATCH_STATUS_POLLING_INTERVAL,
            maxDuration,
            exitCondition: (data) => data.files[0].status !== BatchItemStatus.ATTACHING && data.files[0].status !== ("UPLOADING" as any),
            returnLastOnTimeout: true
        }
    );

    if (
        result.files[0].status === BatchItemStatus.ATTACH_FAILED
        || result.files[0].status === BatchItemStatus.UPLOAD_FAILED
    ) {
        throw new Error(
            `File upload failed. Details: ${JSON.stringify(result.files[0].errors)}`
        );
    }

    return result;
};
