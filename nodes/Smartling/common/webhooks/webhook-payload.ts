import { EventTypes } from "./event-types";

export interface WebhookPayload {
    [key: string]: any;
    schemaVersion: "1.0";
    eventId: string;
    eventType: EventTypes;
    account: {
        accountUid: string;
        accountName: string;
    };
}
