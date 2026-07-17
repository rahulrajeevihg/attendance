import { NextRequest, NextResponse } from "next/server";

import {
    buildErpUrl,
    cookieMapToHeader,
    deserializeCookieMap,
    ERP_HEADERS,
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

export async function POST(request: NextRequest) {
    const { usr, pwd } = await request.json();

    const loginResponse = await fetch(buildErpUrl("/api/method/login"), {
        method: "POST",
        headers: ERP_HEADERS,
        body: JSON.stringify({ usr, pwd }),
    });

    if (!loginResponse.ok) {
        return NextResponse.json({ message: "Invalid credentials" }, { status: loginResponse.status });
    }

    const existingCookies = deserializeCookieMap(request.cookies.get(ERPNEXT_SESSION_COOKIE)?.value);
    const loginCookies = parseSetCookieHeaders(loginResponse.headers.getSetCookie());
    const mergedCookies = mergeCookieMaps(existingCookies, loginCookies);
    const cookieHeader = cookieMapToHeader(mergedCookies);

    const employeeUrl = buildErpUrl(
        `/api/resource/Employee?fields=["name","employee_name","reports_to","image"]&filters=[["user_id", "=", "${usr}"]]`
    );
    let employeeResponse = await fetch(employeeUrl, {
        method: "GET",
        headers: {
            ...ERP_HEADERS,
            Cookie: cookieHeader,
        },
    });

    if (employeeResponse.status === 401 || employeeResponse.status === 403) {
        employeeResponse = await fetch(employeeUrl, {
            method: "GET",
            headers: ERP_TOKEN_HEADERS,
        });
    }

    if (!employeeResponse.ok) {
        const errorBody = await employeeResponse.text();
        return NextResponse.json(
            { message: `Failed to fetch Employee data after login`, details: errorBody },
            { status: employeeResponse.status }
        );
    }

    const employeeData = await employeeResponse.json();
    const employee = employeeData.data?.[0] || null;

    const response = NextResponse.json({ employee });
    response.cookies.set(ERPNEXT_SESSION_COOKIE, serializeCookieMap(mergedCookies), sessionCookieOptions);
    return response;
}
