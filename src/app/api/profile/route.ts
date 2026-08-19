import { NextResponse } from "next/server";
import { profile } from "@/lib/jdMatcher";

export async function GET() {
  return NextResponse.json(profile);
}
