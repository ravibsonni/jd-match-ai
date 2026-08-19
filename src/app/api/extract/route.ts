import { NextResponse } from "next/server";
import { cleanText, extractFileText, extractUrlText } from "@/lib/jdMatcher";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const url = String(formData.get("url") ?? "").trim();
    const jdText = String(formData.get("jd_text") ?? "").trim();
    const file = formData.get("file");

    let source = "";
    let text = "";

    if (jdText) {
      source = "pasted";
      text = cleanText(jdText);
    } else if (url) {
      source = "url";
      text = await extractUrlText(url);
    } else if (file && typeof file !== "string") {
      source = "file";
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      if (fileBytes.length > 10_000_000) {
        throw new Error("Uploaded files must be 10 MB or smaller");
      }
      text = await extractFileText(file.name || "upload", fileBytes);
    } else {
      throw new Error("Provide a URL, pasted JD, or upload a file");
    }

    return NextResponse.json({ source, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    return NextResponse.json({ detail: message }, { status: 400 });
  }
}
