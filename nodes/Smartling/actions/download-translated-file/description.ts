import type { INodeProperties } from "n8n-workflow";

export const downloadTranslatedFileDescription: INodeProperties[] = [
    {
        displayName: "Project",
        name: "projectUid",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        required: true,
        description: "The Smartling project to download from",
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
                resource: ["file"],
                operation: ["download"]
            }
        }
    },
    {
        displayName: "File URI",
        name: "fileUri",
        type: "string",
        default: "",
        required: true,
        description: "The URI of the file to download (e.g., \"files/test-file.json\")",
        displayOptions: {
            show: {
                resource: ["file"],
                operation: ["download"]
            }
        }
    },
    {
        displayName: "Target Locale",
        name: "targetLocale",
        type: "options",
        typeOptions: {
            loadOptionsMethod: "getProjectLocales",
            loadOptionsDependsOn: ["projectUid"]
        },
        default: "",
        required: true,
        description: "The language code for the downloaded translation (e.g., \"es\" for Spanish)",
        displayOptions: {
            show: {
                resource: ["file"],
                operation: ["download"]
            }
        }
    },
    {
        displayName: "Download Mode",
        name: "retrievalType",
        type: "options",
        options: [
            {
                name: "Download Published Translations",
                value: "published"
            },
            {
                name: "Download All Saved Translations",
                value: "pending"
            },
        ],
        default: "published",
        required: false,
        description: "Determines which translations to include in the download",
        displayOptions: {
            show: {
                resource: ["file"],
                operation: ["download"]
            }
        }
    },
    {
        displayName: "Include Original Strings",
        name: "includeOriginalStrings",
        type: "boolean",
        default: false,
        required: false,
        description: "Whether to return the original string when no translation exists",
        displayOptions: {
            show: {
                resource: ["file"],
                operation: ["download"]
            }
        }
    }
];
