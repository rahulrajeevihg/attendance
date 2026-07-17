import { NextResponse } from "next/server";

import { ERPNEXT_SESSION_COOKIE } from "@/lib/erpnext-server";

export async function POST() {
    const response = NextResponse.json({ ok: true });
    response.cookies.delete(ERPNEXT_SESSION_COOKIE);
    return response;
}
