import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jd-matcher",
    endpoints: ["/api/health", "/api/profile", "/api/extract", "/api/analyze"],
  });
}
