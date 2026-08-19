import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    llm_configured: Boolean(process.env.OPENAI_API_KEY),
  });
}
