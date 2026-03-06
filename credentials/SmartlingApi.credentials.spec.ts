import { SmartlingApi } from "./SmartlingApi.credentials";

describe("SmartlingApi Credentials", () => {
    it("should have correct name", () => {
        const cred = new SmartlingApi();
        expect(cred.name).toBe("smartlingApi");
    });

    it("should have correct display name", () => {
        const cred = new SmartlingApi();
        expect(cred.displayName).toBe("Smartling API");
    });

    it("should define userIdentifier field", () => {
        const cred = new SmartlingApi();
        const field = cred.properties.find(p => p.name === "userIdentifier");
        expect(field).toBeDefined();
        expect(field!.type).toBe("string");
        expect(field!.required).toBe(true);
    });

    it("should define userSecret field as password", () => {
        const cred = new SmartlingApi();
        const field = cred.properties.find(p => p.name === "userSecret");
        expect(field).toBeDefined();
        expect(field!.type).toBe("string");
        expect(field!.typeOptions).toEqual({ password: true });
        expect(field!.required).toBe(true);
    });
});
