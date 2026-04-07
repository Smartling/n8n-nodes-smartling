import { EventTypes } from "./event-types";
import { WebhookPayload } from "./webhook-payload";

export const WEBHOOK_BASE_PAYLOAD: WebhookPayload = {
    schemaVersion: "1.0",
    eventType: "" as EventTypes,
    eventId: "event-id",
    account: {
        accountUid: "account-uid",
        accountName: "account-name"
    }
};

export const WEBHOOK_LOCALE_PAYLOAD = {
    localeId: "fr-FR",
    description: "French (France)"
};

export const WEBHOOK_PROJECT_PAYLOAD = {
    projectUid: "project-uid",
    projectName: "project-name",
    projectTypeCode: "project-type-code",
    sourceLocale: WEBHOOK_LOCALE_PAYLOAD,
    targetLocales: [WEBHOOK_LOCALE_PAYLOAD]
};

export const WEBHOOK_PUBLISHED_FILE_PAYLOAD = {
    fileUid: "file-uid",
    fileUri: "sample.xml",
    fileType: "file-type",
    publishedLocale: WEBHOOK_LOCALE_PAYLOAD,
    createdDate: "2023-01-01T00:00:00Z",
    lastUploadedDate: "2023-01-01T00:00:00Z",
    publishDate: "2023-01-01T00:00:00Z",
    namespace: "file-namespace",
    callbackUrl: "callback-url"
};

export const WEBHOOK_USER_PAYLOAD = {
    userUid: "user-uid",
    firstName: "user-first-name",
    lastName: "user-last-name"
};

export const WEBHOOK_ISSUE_COMMENT_PAYLOAD = {
    commentUid: "comment-uid",
    commentText: "comment-text",
    commentCreatedDate: "2017-09-06T20:29:15Z",
    commentUpdatedDate: "2017-09-06T20:29:15Z",
    commentMentions: {
        users: [WEBHOOK_USER_PAYLOAD]
    },
    createdByUser: WEBHOOK_USER_PAYLOAD
};

export const WEBHOOK_SOURCE_ISSUE_PAYLOAD = {
    sourceIssueUid: "issue-uid",
    // TODO: This property is described in schema but not set
    // in the actual webhook payload. Commented out for now.
    // sourceIssueNumber: 1001,
    sourceIssueText: "issue-text",
    sourceIssueSubType: {
        code: "CLARIFICATION",
        description: "Clarification"
    },
    sourceIssueSeverityLevel: {
        code: "HIGH",
        description: "High"
    },
    sourceIssueState: {
        code: "OPENED",
        description: "Opened"
    },
    sourceIssueMentions: {
        users: [WEBHOOK_USER_PAYLOAD]
    },
    hashcode: "abc123def456",
    reportedByUser: WEBHOOK_USER_PAYLOAD,
    assigneeUser: WEBHOOK_USER_PAYLOAD,
    resolvedByUser: WEBHOOK_USER_PAYLOAD,
    createdDate: "2024-01-15T10:30:00Z",
    resolvedDate: "2024-01-15T11:30:00Z",
    reopenedDate: "2024-01-15T12:00:00Z",
    answered: false,
    reactivated: false,
    comments: [
        WEBHOOK_ISSUE_COMMENT_PAYLOAD
    ]
};

export const WEBHOOK_TRANSLATION_ISSUE_PAYLOAD = {
    translationIssueUid: "translation-issue-uid",
    translationIssueText: "translation-issue-text",
    translationIssueSubType: {
        code: "CLARIFICATION",
        description: "Clarification"
    },
    translationIssueSeverityLevel: {
        code: "HIGH",
        description: "High"
    },
    translationIssueState: {
        code: "OPENED",
        description: "Opened"
    },
    translationIssueMentions: {
        users: [WEBHOOK_USER_PAYLOAD]
    },
    locale: WEBHOOK_LOCALE_PAYLOAD,
    hashcode: "abc123def456",
    reportedByUser: WEBHOOK_USER_PAYLOAD,
    assigneeUser: WEBHOOK_USER_PAYLOAD,
    resolvedByUser: WEBHOOK_USER_PAYLOAD,
    createdDate: "2024-01-15T10:30:00Z",
    resolvedDate: "2024-01-15T11:30:00Z",
    reopenedDate: "2024-01-15T12:00:00Z",
    answered: false,
    reactivated: false,
    comments: [
        WEBHOOK_ISSUE_COMMENT_PAYLOAD
    ]
};

export const WEBHOOK_CUSTOM_FIELD_PAYLOAD = {
    customField: {
        customFieldValue: "Not provided yet - job created via automation",
        customFieldUid: "echuug4jnixj",
        customFieldType: "SHORT_TEXT",
        customFieldName: "Short text",
        customFieldDescription: "Description Label"
    }
};

export const WEBHOOK_TRANSLATION_JOB_FILE_PAYLOAD = {
    fileUri: "/file/app1.properties",
    fileUid: "1234g67h90",
    localeIds: ["ua-UK"]
};

export const WEBHOOK_TRANSLATION_JOB_TARGET_LOCALE_PAYLOAD = {
    localeId: "ua-UK",
    description: "Ukrainian [ua-UK]",
    status: "completed"
};

export const WEBHOOK_ASSET_EXPORTED_PAYLOAD = {
    integrationId: "shopify",
    fileUri: "sample-asset-PRODUCT-123456.json",
    assetUid: "PRODUCT-123456",
    externalAssetId: null as string | null,
    targetLocales: [WEBHOOK_LOCALE_PAYLOAD]
};

export const WEBHOOK_TRANSLATION_JOB_PAYLOAD = {
    createdDate: "2025-04-15T16:14:18+00:00",
    updatedDate: "2025-04-15T16:14:18+00:00",
    rushRequest: false,
    jobUid: "job-uid",
    jobStatus: "IN_PROGRESS",
    customFields: [WEBHOOK_CUSTOM_FIELD_PAYLOAD],
    createdByUser: WEBHOOK_USER_PAYLOAD,
    jobNumber: "abc-123",
    jobName: "This is job name",
    jobDescription: "Description",
    jobDueDate: "2025-04-25T16:14:18+00:00",
    referenceNumber: "X1234",
    updatedByUser: WEBHOOK_USER_PAYLOAD,
    authorizedByUser: WEBHOOK_USER_PAYLOAD,
    files: [WEBHOOK_TRANSLATION_JOB_FILE_PAYLOAD],
    targetLocales: [WEBHOOK_TRANSLATION_JOB_TARGET_LOCALE_PAYLOAD]
};
