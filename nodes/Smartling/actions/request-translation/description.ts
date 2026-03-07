import type { INodeProperties } from "n8n-workflow";
import { FileType, fileDescriptionMap } from "../../common/files";

const requestTranslationFileTypes = [
    FileType.IDML,
    FileType.INDD,
    FileType.ANDROID,
    FileType.CSV,
    FileType.DITA,
    FileType.GETTEXT,
    FileType.HTML,
    FileType.IOS,
    FileType.XCSTRINGS,
    FileType.STRINGSDICT,
    FileType.JAVA_PROPERTIES,
    FileType.JSON,
    FileType.FLARE,
    FileType.MADCAP,
    FileType.MARKDOWN,
    FileType.XLSX,
    FileType.PPTX,
    FileType.VSDX,
    FileType.DOCX,
    FileType.PDF,
    FileType.PLAIN_TEXT,
    FileType.PRES,
    FileType.QT,
    FileType.RESX,
    FileType.SVG,
    FileType.SRT,
    FileType.VTT,
    FileType.XLIFF,
    FileType.XLIFF2,
    FileType.XML,
    FileType.YAML
];

const fileTypeOptions = requestTranslationFileTypes
    .map((type) => ({
        name: fileDescriptionMap[type],
        value: type
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

export const requestTranslationDescription: INodeProperties[] = [
    {
        displayName: "Project",
        name: "projectUid",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        required: true,
        description: "The Smartling project to upload the file to",
        modes: [
            {
                displayName: "From List",
                name: "list",
                type: "list",
                typeOptions: {
                    searchListMethod: "searchProjects",
                    searchable: true
                }
            },
            {
                displayName: "By ID",
                name: "id",
                type: "string",
                placeholder: "e.g. 4bca2a7b8",
                validation: [
                    {
                        type: "regex",
                        properties: {
                            regex: "^[a-zA-Z0-9]+$",
                            errorMessage: "Project UID must be alphanumeric"
                        }
                    }
                ]
            }
        ],
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    },
    {
        displayName: "Job Type",
        name: "dailyJobType",
        type: "options",
        options: [
            {
                name: "Daily Job",
                value: "dailyJob"
            },
            {
                name: "Custom Daily Job",
                value: "customDailyJob"
            }
        ],
        default: "dailyJob",
        required: true,
        description: "Whether to use a standard daily job or a custom daily job",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    },
    {
        displayName: "Job Custom Name Prefix",
        name: "dailyJobNamePrefix",
        type: "string",
        default: "",
        required: false,
        description: "Custom name prefix for the daily job (max 75 characters)",
        typeOptions: {
            maxLength: 75
        },
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"],
                dailyJobType: ["customDailyJob"]
            }
        }
    },
    {
        displayName: "Job Reference Number",
        name: "jobReferenceNumber",
        type: "string",
        default: "",
        required: false,
        description: "Reference number for the job (max 100 characters)",
        typeOptions: {
            maxLength: 100
        },
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"],
                dailyJobType: ["customDailyJob"]
            }
        }
    },
    {
        displayName: "Target Locales",
        name: "targetLocales",
        type: "multiOptions",
        typeOptions: {
            loadOptionsMethod: "getProjectLocales",
            loadOptionsDependsOn: ["projectUid"]
        },
        default: [],
        required: true,
        description: "The target locales for translation",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    },
    {
        displayName: "Authorize Job For Translation",
        name: "translationJobAuthorize",
        type: "boolean",
        default: false,
        required: false,
        description: "Whether to authorize the job for translation after uploading the file",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    },
    {
        displayName: "Target Language Workflow",
        name: "targetLanguageWorkflow",
        type: "options",
        typeOptions: {
            loadOptionsMethod: "getProjectWorkflows",
            loadOptionsDependsOn: ["projectUid"]
        },
        default: "",
        required: false,
        description: "The workflow to use for translation (leave blank to use project default)",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"],
                translationJobAuthorize: [true]
            }
        }
    },
    {
        displayName: "Binary Property",
        name: "binaryPropertyName",
        type: "string",
        default: "={{ $('Binary data node').item.binary.data }}",
        required: true,
        description: "Name of the binary property containing the file to upload",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    },
    {
        displayName: "File URI",
        name: "fileUri",
        type: "string",
        default: "",
        required: true,
        description: "Unique file identifier in the project",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    },
    {
        displayName: "File Type",
        name: "fileType",
        type: "options",
        options: [
            {
                name: "Auto-Detect",
                value: ""
            },
            ...fileTypeOptions
        ],
        default: "",
        required: false,
        description: "The file type (leave blank for auto-detection)",
        displayOptions: {
            show: {
                resource: ["translation"],
                operation: ["requestTranslation"]
            }
        }
    }
];
