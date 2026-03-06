import { SmartlingApiClientBuilder } from "smartling-api-sdk-nodejs";
import { API_URL, API_CLIENT_IDENTIFIER } from "./constants";

export interface SmartlingCredentials {
    userIdentifier: string;
    userSecret: string;
}

export const createApiBuilder = (credentials: SmartlingCredentials, version: string) =>
    new SmartlingApiClientBuilder()
        .setBaseSmartlingApiUrl(API_URL)
        .authWithUserIdAndUserSecret(credentials.userIdentifier, credentials.userSecret)
        .setClientLibMetadata(API_CLIENT_IDENTIFIER, version);
