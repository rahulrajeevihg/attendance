const ERPNEXT_URL = "https://erp.ihgind.com";
const SESSION_COOKIE_NAME = "erpnext_session";
const API_TOKEN = "token e9d536fe3a27e08:ceb907fddc6d661";

type CookieMap = Record<string, string>;

export const ERP_HEADERS = {
    "Content-Type": "application/json",
    Accept: "application/json",
} as const;

export const ERP_TOKEN_HEADERS = {
    ...ERP_HEADERS,
    Authorization: API_TOKEN,
} as const;

export const buildErpUrl = (path: string, search = "") => `${ERPNEXT_URL}${path}${search}`;

export const parseSetCookieHeaders = (setCookieHeaders: string[]): CookieMap => {
    const cookies: CookieMap = {};

    for (const header of setCookieHeaders) {
        const [pair] = header.split(";", 1);
        const separatorIndex = pair.indexOf("=");
        if (separatorIndex === -1) continue;

        const name = pair.slice(0, separatorIndex).trim();
        const value = pair.slice(separatorIndex + 1).trim();
        if (name) {
            cookies[name] = value;
        }
    }

    return cookies;
};

export const serializeCookieMap = (cookies: CookieMap) =>
    Buffer.from(JSON.stringify(cookies), "utf8").toString("base64url");

export const deserializeCookieMap = (encoded: string | undefined): CookieMap => {
    if (!encoded) return {};

    try {
        return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CookieMap;
    } catch {
        return {};
    }
};

export const cookieMapToHeader = (cookies: CookieMap) =>
    Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");

export const mergeCookieMaps = (current: CookieMap, incoming: CookieMap): CookieMap => ({
    ...current,
    ...incoming,
});

export const getCsrfToken = (cookies: CookieMap) => cookies.csrf_token || cookies.full_name || "";

export const ERPNEXT_SESSION_COOKIE = SESSION_COOKIE_NAME;
