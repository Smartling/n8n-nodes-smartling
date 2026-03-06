import { Context } from "../../common/context";
import { FileType } from "../../common/files";
import { detectFileType, FileContentForDetection } from "../../common/files/file-type";
import { retrieveJob, addFileToJob, DailyJobType } from "./job-service";
import { validateWorkflow } from "./workflow-validator";

export interface RequestTranslationParams {
    projectUid: string;
    accountUid: string;
    dailyJobType: string;
    dailyJobNamePrefix?: string;
    jobReferenceNumber?: string;
    targetLocales: string[];
    translationJobAuthorize: boolean;
    targetLanguageWorkflow?: string;
    fileBuffer: Buffer;
    fileName: string;
    fileUri: string;
    fileType?: string;
}

const detectFileTypeIfRequired = async (
    ctx: Context,
    fileType: string | undefined,
    fileBuffer: Buffer,
    fileName: string
): Promise<FileType> => {
    if (fileType) {
        return fileType as FileType;
    }

    const fileContent: FileContentForDetection = {
        fileName,
        content: fileBuffer
    };

    return detectFileType(ctx.logger, fileContent, ctx.getFileTypeApi());
};

export const executeRequestTranslation = async (
    ctx: Context,
    params: RequestTranslationParams
): Promise<Record<string, unknown>> => {
    const startTime = Date.now();

    ctx.logger.info("Request Translation action started.", {
        projectUid: params.projectUid,
        dailyJobType: params.dailyJobType,
        targetLocales: params.targetLocales,
        fileUri: params.fileUri,
        authorize: params.translationJobAuthorize
    });

    await validateWorkflow(
        ctx,
        params.projectUid,
        params.accountUid,
        params.translationJobAuthorize,
        params.targetLanguageWorkflow,
        params.targetLocales
    );

    const fileType = await detectFileTypeIfRequired(
        ctx,
        params.fileType,
        params.fileBuffer,
        params.fileName
    );

    const job = await retrieveJob(ctx, {
        projectUid: params.projectUid,
        jobType: params.dailyJobType as DailyJobType,
        jobNamePrefix: params.dailyJobNamePrefix,
        referenceNumber: params.jobReferenceNumber,
        targetLocalesIds: params.targetLocales
    });

    const batchResult = await addFileToJob(ctx, {
        projectUid: params.projectUid,
        translationJobUid: job.translationJobUid,
        authorize: params.translationJobAuthorize,
        fileUri: params.fileUri,
        workflowUid: params.targetLanguageWorkflow,
        targetLocalesIds: params.targetLocales,
        fileContent: params.fileBuffer,
        fileType,
        startTime
    });

    ctx.logger.info("Request Translation completed successfully.", {
        projectUid: params.projectUid,
        translationJobUid: job.translationJobUid,
        translationJobName: job.jobName,
        fileUri: params.fileUri,
        workflowUid: params.targetLanguageWorkflow,
        targetLocales: params.targetLocales,
        fileType,
        authorize: params.translationJobAuthorize
    });

    const file = batchResult.files[0];

    const output: Record<string, unknown> = {
        translationJobUid: job.translationJobUid,
        translationJobName: job.jobName,
        translationJobCreatedDate: job.createdDate,
        translationJobReferenceNumber: job.referenceNumber,
        translationJobDescription: job.description,
        translationJobDueDate: job.dueDate,
        translationJobTargetLocaleIds: job.targetLocaleIds
    };

    if (file) {
        return {
            ...output,
            fileUri: file.fileUri,
            fileUploadStatus: file.status,
            fileUploadErrors: file.errors,
            fileUploadTargetLocaleIds: file.targetLocales.map((l: any) => l.localeId)
        };
    }

    return output;
};
