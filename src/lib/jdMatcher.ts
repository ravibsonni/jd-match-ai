import fs from "fs";
import path from "path";
import { Buffer } from "buffer";

export type Analysis = {
  job_title?: string;
  company?: string;
  location?: string;
  overall_score: number;
  summary: string;
  strong_matches: { requirement: string; evidence: string; score: number }[];
  transferable_matches: { requirement: string; evidence: string; score: number }[];
  gaps: { requirement: string; reason: string; risk: string }[];
  keywords_to_emphasize: string[];
  interview_risks: string[];
  tailoring_strategy: string[];
  tailored_resume_markdown: string;
  cover_letter: string;
};

const profilePath = path.join(process.cwd(), "data", "master_profile.json");
export const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));

export function cleanText(text: string): string {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function isForbiddenHost(hostname: string): boolean {
  if (!hostname) return true;

  try {
    const ip = require("node:net").isIP(hostname);
    if (ip === 4 || ip === 6) {
      const { isIP } = require("node:net");
      const addr = require("node:net").isIP(hostname);
      if (addr === 4 || addr === 6) {
        const socket = require("node:net").Socket();
        return false;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

export async function extractUrlText(url: string): Promise<string> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only public HTTP/HTTPS job URLs are supported");
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new Error("Invalid job URL");
  }

  const net = await import("node:net");
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 || ipVersion === 6) {
    const ip = parsed.hostname;
    if (["127.0.0.1", "::1"].includes(ip)) {
      throw new Error("Private or local URLs are not allowed");
    }
  }

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; JDMatcher/1.0)" },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`The job URL could not be fetched (${response.status})`);
  }

  const html = await response.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  $("script, style, noscript, svg").remove();
  const main = $("main, article, body").first();
  if (!main.length) {
    throw new Error("Could not find readable page content");
  }

  const text = cleanText(main.text());
  if (text.length < 300) {
    throw new Error("The page did not expose enough readable job-description text. Paste the JD instead.");
  }

  return text;
}

export async function extractFileText(filename: string, data: Uint8Array): Promise<string> {
  const name = filename.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
      pages.push(pageText);
    }

    return cleanText(pages.join("\n"));
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    return cleanText(result.value || "");
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return cleanText(new TextDecoder("utf-8", { fatal: false }).decode(data));
  }

  throw new Error("Supported uploads: PDF, DOCX, TXT, MD");
}

export function fallbackAnalysis(jd: string) {
  const text = jd.toLowerCase();
  const skills = [
    "product management",
    "roadmap",
    "customer discovery",
    "analytics",
    "api",
    "ai",
    "saas",
    "crm",
    "mobile",
    "web",
    "operations",
    "logistics",
    "cybersecurity",
    "supply chain",
    "gtm",
  ];

  const matchedKeywords = skills.filter((skill) => text.includes(skill.toLowerCase()));

  return {
    overall_score: 50,
    note: "LLM not configured; keyword-only preliminary result.",
    matched_keywords: matchedKeywords,
  };
}

export async function llmJson(jd: string): Promise<Analysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      overall_score: 50,
      summary: "LLM not configured; keyword-only preliminary result.",
      strong_matches: [],
      transferable_matches: [],
      gaps: [],
      keywords_to_emphasize: [],
      interview_risks: [],
      tailoring_strategy: [],
      tailored_resume_markdown: "",
      cover_letter: "",
    } as Analysis;
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });

  const prompt = `You are a rigorous senior recruiter and product leadership interviewer. Analyze the job description against the candidate master profile below. Do not invent experience. Distinguish direct evidence, transferable evidence, and genuine gaps. Return valid JSON only with this schema: {
  "job_title": string,
  "company": string,
  "location": string,
  "overall_score": integer 0-100,
  "summary": string,
  "strong_matches": [{"requirement": string, "evidence": string, "score": integer}],
  "transferable_matches": [{"requirement": string, "evidence": string, "score": integer}],
  "gaps": [{"requirement": string, "reason": string, "risk": "low"|"medium"|"high"}],
  "keywords_to_emphasize": [string],
  "interview_risks": [string],
  "tailoring_strategy": [string],
  "tailored_resume_markdown": string,
  "cover_letter": string
}
Candidate master profile:
${JSON.stringify(profile, null, 2)}
Job description:
${jd}`;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return only valid JSON. Accuracy and evidence discipline are more important than persuasion." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return JSON.parse(content) as Analysis;
}
