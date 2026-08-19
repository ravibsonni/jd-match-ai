import { NextResponse } from "next/server";
import { cleanText, llmJson } from "@/lib/jdMatcher";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jdText = cleanText(String(body?.jd_text || ""));

    if (jdText.length < 100) {
      return NextResponse.json(
        { detail: "JD is too short" },
        { status: 400 }
      );
    }

    const result = await llmJson(jdText);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ detail: `Analysis failed: ${message}` }, { status: 500 });
  }
}
