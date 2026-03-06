import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class SmartlingApi implements ICredentialType {
    name = "smartlingApi";
    displayName = "Smartling API";
    documentationUrl = "https://help.smartling.com/hc/en-us/articles/115003028634-API";

    properties: INodeProperties[] = [
        {
            displayName: "User Identifier",
            name: "userIdentifier",
            type: "string",
            default: "",
            required: true,
            description: "API User Identifier from Smartling Dashboard > Account Settings > API",
        },
        {
            displayName: "User Secret",
            name: "userSecret",
            type: "string",
            typeOptions: { password: true },
            default: "",
            required: true,
            description: "API Token Secret generated with the User Identifier",
        },
    ];
}
