import { NextResponse } from "next/server";
import { buildFallbackAnalysis, cleanText, llmJson } from "@/lib/jdMatcher";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jdText = cleanText(String(body?.jd_text || ""));

    if (jdText.length < 100) {
      return NextResponse.json({ detail: "JD is too short" }, { status: 400 });
    }

    const result = await llmJson(jdText);
    return NextResponse.json(result);
  } catch (error) {
    let fallbackText = "";
    try {
      const body = await request.clone().json();
      fallbackText = String(body?.jd_text || "");
    } catch {
      fallbackText = "";
    }

    return NextResponse.json(buildFallbackAnalysis(cleanText(fallbackText)), { status: 200 });
  }
}
