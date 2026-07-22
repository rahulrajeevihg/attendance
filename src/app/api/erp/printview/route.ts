import { NextRequest, NextResponse } from "next/server";

import {
    buildErpUrl,
    cookieMapToHeader,
    deserializeCookieMap,
    ERP_TOKEN_HEADERS,
    ERPNEXT_SESSION_COOKIE,
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

export async function GET(request: NextRequest) {
    const cookieMap = deserializeCookieMap(request.cookies.get(ERPNEXT_SESSION_COOKIE)?.value);
    const cookieHeader = cookieMapToHeader(cookieMap);
    const upstreamUrl = buildErpUrl("/printview", request.nextUrl.search);

    let upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: cookieHeader
            ? {
                Cookie: cookieHeader,
                Accept: "text/html,application/xhtml+xml",
            }
            : {
                ...ERP_TOKEN_HEADERS,
                Accept: "text/html,application/xhtml+xml",
            },
    });

    if ((upstreamResponse.status === 401 || upstreamResponse.status === 403) && cookieHeader) {
        upstreamResponse = await fetch(upstreamUrl, {
            method: "GET",
            headers: {
                ...ERP_TOKEN_HEADERS,
                Accept: "text/html,application/xhtml+xml",
            },
        });
    }

    const responseText = await upstreamResponse.text();
    const response = new NextResponse(responseText, {
        status: upstreamResponse.status,
        headers: {
            "Content-Type": upstreamResponse.headers.get("content-type") || "text/html; charset=utf-8",
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
