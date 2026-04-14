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
    context: any,
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

    return detectFileType(context, fileContent);
};

export const executeRequestTranslation = async (
    context: any,
    params: RequestTranslationParams
): Promise<Record<string, unknown>> => {
    await validateWorkflow(
        context,
        params.projectUid,
        params.accountUid,
        params.translationJobAuthorize,
        params.targetLanguageWorkflow,
        params.targetLocales
    );

    const fileType = await detectFileTypeIfRequired(
        context,
        params.fileType,
        params.fileBuffer,
        params.fileName
    );

    const job = await retrieveJob(context, {
        projectUid: params.projectUid,
        jobType: params.dailyJobType as DailyJobType,
        jobNamePrefix: params.dailyJobNamePrefix,
        referenceNumber: params.jobReferenceNumber,
        targetLocalesIds: params.targetLocales
    });

    const batchResult = await addFileToJob(context, {
        projectUid: params.projectUid,
        translationJobUid: job.translationJobUid,
        authorize: params.translationJobAuthorize,
        fileUri: params.fileUri,
        workflowUid: params.targetLanguageWorkflow,
        targetLocalesIds: params.targetLocales,
        fileContent: params.fileBuffer,
        fileType
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
            batchUid: batchResult.batchUid,
            fileUri: file.fileUri,
            fileUploadStatus: file.status,
            fileUploadErrors: file.errors,
            fileUploadTargetLocaleIds: file.targetLocales.map((l: any) => l.localeId)
        };
    }

    return output;
};
