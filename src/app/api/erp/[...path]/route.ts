import { NextRequest, NextResponse } from "next/server";

import {
    buildErpUrl,
    cookieMapToHeader,
    deserializeCookieMap,
    ERP_HEADERS,
    ERP_TOKEN_HEADERS,
    ERPNEXT_SESSION_COOKIE,
    getCsrfToken,
    mergeCookieMaps,
    parseSetCookieHeaders,
    serializeCookieMap,
} from "@/lib/erpnext-server";

const sessionCookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
};

async function proxy(request: NextRequest, path: string[]) {
    const cookieMap = deserializeCookieMap(request.cookies.get(ERPNEXT_SESSION_COOKIE)?.value);
    const cookieHeader = cookieMapToHeader(cookieMap);

    const targetUrl = buildErpUrl(`/api/${path.join("/")}`, request.nextUrl.search);
    const requestBody =
        request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
    const csrfToken = getCsrfToken(cookieMap);
    const sessionHeaders = cookieHeader
        ? {
            ...ERP_HEADERS,
            Cookie: cookieHeader,
            ...(csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : {}),
        }
        : null;

    let upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers: sessionHeaders ?? ERP_TOKEN_HEADERS,
        body: requestBody,
    });

    if ((upstreamResponse.status === 401 || upstreamResponse.status === 403) && sessionHeaders) {
        upstreamResponse = await fetch(targetUrl, {
            method: request.method,
            headers: ERP_TOKEN_HEADERS,
            body: requestBody,
        });
    }

    const responseText = await upstreamResponse.text();
    const response = new NextResponse(responseText, {
        status: upstreamResponse.status,
        headers: {
            "Content-Type": upstreamResponse.headers.get("content-type") || "application/json",
        },
    });

    const updatedCookies = parseSetCookieHeaders(upstreamResponse.headers.getSetCookie());
    if (Object.keys(updatedCookies).length > 0) {
        response.cookies.set(
            ERPNEXT_SESSION_COOKIE,
            serializeCookieMap(mergeCookieMaps(cookieMap, updatedCookies)),
            sessionCookieOptions
        );
    }

    return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    return proxy(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    return proxy(request, path);
}
