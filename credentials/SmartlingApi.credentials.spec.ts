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

    it("should have authenticate method", () => {
        const cred = new SmartlingApi();
        expect(typeof cred.authenticate).toBe("function");
    });

    it("authenticate should inject Bearer Authorization header", async () => {
        const cred = new SmartlingApi();
        const credentials = { accessToken: "test-access-token" };
        const requestOptions = { headers: { "Content-Type": "application/json" } };

        const authenticateFn = cred.authenticate as Function;
        const result = await authenticateFn(credentials, requestOptions as any);

        expect(result.headers).toMatchObject({
            "Content-Type": "application/json",
            Authorization: "Bearer test-access-token",
        });
    });

    it("authenticate should work with no pre-existing headers", async () => {
        const cred = new SmartlingApi();
        const credentials = { accessToken: "my-token" };
        const requestOptions = {};

        const authenticateFn = cred.authenticate as Function;
        const result = await authenticateFn(credentials, requestOptions as any);

        expect(result.headers).toMatchObject({
            Authorization: "Bearer my-token",
        });
    });

    it("should have preAuthentication method", () => {
        const cred = new SmartlingApi();
        expect(typeof cred.preAuthentication).toBe("function");
    });

    it("preAuthentication should call auth endpoint and return accessToken", async () => {
        const cred = new SmartlingApi();
        const credentials = {
            userIdentifier: "user-id",
            userSecret: "user-secret",
        };

        const mockHttpRequest = jest.fn().mockResolvedValue({
            response: {
                data: {
                    accessToken: "returned-token",
                },
            },
        });

        const mockContext = {
            helpers: { httpRequest: mockHttpRequest },
        };

        const result = await cred.preAuthentication.call(mockContext as any, credentials);

        expect(mockHttpRequest).toHaveBeenCalledWith({
            method: "POST",
            url: "https://api.smartling.com/auth-api/v2/authenticate",
            body: {
                userIdentifier: "user-id",
                userSecret: "user-secret",
            },
            json: true,
        });
        expect(result).toEqual({ accessToken: "returned-token" });
    });

    it("preAuthentication should handle flat response without response wrapper", async () => {
        const cred = new SmartlingApi();
        const credentials = { userIdentifier: "uid", userSecret: "secret" };

        const mockHttpRequest = jest.fn().mockResolvedValue({
            accessToken: "flat-token",
        });

        const mockContext = {
            helpers: { httpRequest: mockHttpRequest },
        };

        const result = await cred.preAuthentication.call(mockContext as any, credentials);
        expect(result).toEqual({ accessToken: "flat-token" });
    });

    it("should have a test configuration with request", () => {
        const cred = new SmartlingApi();
        expect(cred.test).toBeDefined();
        expect((cred.test as any).request).toBeDefined();
        expect((cred.test as any).request.method).toBe("GET");
        expect((cred.test as any).request.url).toContain("smartling.com");
    });
});
