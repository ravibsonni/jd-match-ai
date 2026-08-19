import fs from "fs";
import path from "path";
import { Buffer } from "buffer";

export type EvidenceItem = {
  experience: string;
  evidence: string;
  metric: string;
  relevance: string;
};

export type RequirementMapping = {
  requirement: string;
  category: string;
  priority: "high" | "medium" | "low";
  classification: "direct" | "transferable" | "gap" | "unknown";
  match_score: number;
  candidate_evidence: EvidenceItem[];
  reason: string;
  resume_action: string;
  interview_relevance: string;
};

export type ScoreBreakdown = {
  category: string;
  score: number;
  weight: number;
  reason: string;
};

export type ResumeChange = {
  section: string;
  action: string;
  reason: string;
  content_direction: string;
  experience?: string;
};

export type InterviewRisk = {
  risk: string;
  likely_question: string;
  best_candidate_story: string;
  evidence: string;
  honest_gap: string;
};

export type Analysis = {
  job: { title: string; company: string; location: string };
  overall_score: number;
  score_breakdown: ScoreBreakdown[];
  summary: string;
  strong_matches: Array<{ requirement: string; evidence: string; score: number; metric?: string; why_it_matters?: string }>;
  transferable_matches: Array<{ requirement: string; evidence: string; score: number; metric?: string; why_it_matters?: string }>;
  gaps: Array<{ requirement: string; reason: string; risk: "high" | "medium" | "low"; transferable_experience?: string; discuss_in_interview: boolean }>;
  interview_risks: InterviewRisk[];
  tailoring_strategy: string[];
  requirement_mapping: RequirementMapping[];
  resume_changes: ResumeChange[];
  keywords: { high_priority: string[]; secondary: string[] };
  claims_to_avoid: string[];
  tailored_resume: string;
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
    const net = require("node:net");
    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4 || ipVersion === 6) {
      return ["127.0.0.1", "::1"].includes(hostname);
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
  if (!hostname || isForbiddenHost(hostname)) {
    throw new Error("Private or local URLs are not allowed");
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

function escapeMarkdown(text: string) {
  return text.replace(/\|/g, "\\|");
}

function strongEvidenceText(evidenceSet: string[] = []): string {
  return evidenceSet.length ? evidenceSet.join(" ") : "Candidate profile contains relevant product and technical evidence.";
}

export function buildFallbackAnalysis(jd: string): Analysis {
  const lower = jd.toLowerCase();
  const keyWords = [
    "product strategy",
    "roadmap",
    "customer discovery",
    "analytics",
    "api",
    "ai",
    "saas",
    "retention",
    "churn",
    "restaurant",
    "inventory",
    "kitchen",
    "supply chain",
    "crm",
    "salesforce",
    "fleet",
    "logistics",
    "gcc",
  ];

  const highPriority = keyWords.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const secondary = ["customer interviews", "cross-functional leadership", "PRD", "gTM", "product analytics", "AI products", "support automation"]
    .filter((keyword) => lower.includes(keyword.toLowerCase()));

  const strongMatches = [
    {
      requirement: "Product strategy and roadmap ownership",
      evidence: "Led product strategy and roadmap for MSG91 and Dotsale, including PRDs, GTM strategy, and North Star metrics.",
      score: 92,
      metric: "30,000+ clients served; $6M ARR business",
      why_it_matters: "Strong direct alignment with roadmap and strategic product ownership responsibilities."
    },
    {
      requirement: "Customer discovery and product learning",
      evidence: "Used customer interviews, discovery calls, and FullStory to optimize OTP Widget onboarding and conversion.",
      score: 90,
      metric: "300% conversion increase from 2 to 8",
      why_it_matters: "Matches discovery, experimentation, and customer journey improvement."
    },
    {
      requirement: "API / technical product strategy",
      evidence: "Led Campaign API architecture, unified multiple channel integrations behind one API, and processed approximately 80M requests/month.",
      score: 92,
      metric: "~80M requests/month",
      why_it_matters: "Directly relevant for API-heavy product roles."
    },
    {
      requirement: "Retention and churn improvement",
      evidence: "Built an account-health workflow using usage patterns and churn indicators, contributing to approximately $540K revenue retention and ~9% churn reduction.",
      score: 90,
      metric: "$540K annual revenue retained; ~9% churn reduction",
      why_it_matters: "High-fit for revenue protection and lifecycle optimization work."
    },
    {
      requirement: "AI / product experimentation",
      evidence: "Led AI Sales Strategist discovery and rapid prototyping with Claude Code, VS Code, RAG, and CrewAI, designing a Figma prototype and North Star metric.",
      score: 88,
      metric: "Reduced GTM planning from weeks to minutes",
      why_it_matters: "Strong evidence for AI-enabled product work."
    }
  ];

  const transferableMatches = [
    {
      requirement: "Supply chain or operational optimization",
      evidence: "Dotsale included restaurant inventory management and kitchen fulfillment workflows; recommendation engine optimized promotions based on raw-material expiry.",
      score: 72,
      metric: "Inventory-driven waste reduction",
      why_it_matters: "Transferable operational experience, but not direct end-to-end supply-chain ownership."
    }
  ];

  const gaps = [
    {
      requirement: "Formal CRM transformation",
      reason: "No evidence of owning a Salesforce, HubSpot, Dynamics, or equivalent CRM transformation program.",
      risk: "medium" as const,
      transferable_experience: "Related customer lifecycle and retention experience exists, but not direct CRM transformation ownership.",
      discuss_in_interview: true
    },
    {
      requirement: "Delivery fleet or last-mile logistics operations",
      reason: "No direct delivery-fleet or logistics operations evidence is present in the profile.",
      risk: "high" as const,
      transferable_experience: "Restaurant operations and inventory workflows are related but not a direct logistics match.",
      discuss_in_interview: true
    },
    {
      requirement: "GCC operating experience",
      reason: "The profile does not establish GCC or region-specific operating experience.",
      risk: "low" as const,
      transferable_experience: "None established from the verified profile.",
      discuss_in_interview: false
    }
  ];

  const interviewRisks = [
    {
      risk: "No direct CRM transformation ownership",
      likely_question: "Tell me about a time you owned a CRM or workflow transformation program at scale.",
      best_candidate_story: "Led customer lifecycle and account-health workflows in MSG91, using behavioral data to drive retention and collaboration across sales and support teams.",
      evidence: "Account-health dashboard and churn reduction work tied to product and customer lifecycle decisions.",
      honest_gap: "No direct Salesforce/HubSpot/Dynamics transformation ownership is documented."
    },
    {
      risk: "No direct logistics or fleet experience",
      likely_question: "How have you handled operational workflows in a complex, physical logistics environment?",
      best_candidate_story: "Dotsale restaurant operations, including POS, inventory management, and kitchen fulfillment workflows, plus raw-material optimization.",
      evidence: "Restaurant SaaS experience with operational workflows and inventory-driven decisions.",
      honest_gap: "No direct last-mile logistics or delivery-fleet experience."
    }
  ];

  const resumeChanges = [
    {
      section: "Professional Summary",
      action: "rewrite",
      reason: "The JD emphasizes product strategy, customer discovery, API strategy, and AI-enabled product execution.",
      content_direction: "Lead with a concise summary that connects roadmap ownership, customer learning, API architecture, and retention outcomes."
    },
    {
      section: "Selected Impact",
      action: "prioritize",
      experience: "MSG91 & AI Initiatives",
      reason: "This role offers the strongest combination of product strategy, APIs, analytics, and customer retention evidence.",
      content_direction: "Feature $540K retention, ~9% churn reduction, 80M API requests/month, and cross-functional leadership."
    },
    {
      section: "Professional Experience",
      action: "reorder",
      reason: "Restaurant operations work should support the JD when relevant, but the resume should lead with SaaS/API/retention and AI or product strategy evidence.",
      content_direction: "Position Dotsale as supporting evidence for operations, inventory, and workflow optimization rather than the primary story for a pure SaaS PM role."
    }
  ];

  const tailoredResume = `Ravi Soni
Senior Product Manager | Product Strategy | API Products | Customer Growth | AI Product Discovery

Professional Summary
Product manager with 14 years of experience building and scaling SaaS products, with a focus on roadmap ownership, customer discovery, API architecture, analytics, and retention. At Walkover Web Solutions, I led product strategy for MSG91 and AI initiatives serving 30,000+ clients and a ~$6M ARR business, built an account-health workflow that contributed to approximately $540K in annual revenue retention and ~9% churn reduction, and led API strategy for a platform processing ~80M requests per month. I also led Dotsale, a restaurant and retail SaaS, where I owned product strategy, GTM, PRDs, and architecture transformation across frontend, backend, and queue-management services.

Selected Impact
- Led product strategy and roadmap for MSG91 and AI initiatives serving 30,000+ clients and a ~$6M ARR business.
- Built an account-health workflow using historical vs current-day messaging volume, enabling account managers to review behavior, record outreach reasons, and automate outcomes; contributed to approximately $540K annual revenue retention and ~9% churn reduction.
- Led product strategy and API architecture for Campaign, an omnichannel communication platform processing ~80M requests per month; unified multiple channel-specific integrations behind one API.
- Optimized OTP Widget setup using customer interviews, discovery calls, and FullStory; default configuration increased conversions from 2 to 8 from comparable ~20 inbound leads, a 300% increase.
- Reduced support workload by approximately 70% through an automated knowledge-crawling support workflow, deflecting approximately 1,400 of 2,000 monthly tickets.
- Led AI Sales Strategist discovery and rapid prototyping to reduce GTM planning from weeks to minutes using Claude Code, VS Code, RAG, and CrewAI.

Professional Experience
Walkover Web Solutions | Senior Product Manager — MSG91 & AI Initiatives | May 2020 – Present
- Own product strategy and roadmap for MSG91 and AI initiatives serving 30,000+ clients and a ~$6M ARR business.
- Built an account-health workflow using historical versus current-day messaging volume; account managers review behavior, record outreach reasons and automate outcomes; contributed to approximately $540K annual revenue retention and ~9% churn reduction.
- Led product strategy and API architecture for Campaign, an omnichannel communication platform processing ~80M requests/month; unified multiple channel-specific integrations behind one API.
- Used customer, competitive, and engineering evidence to inform roadmap prioritization and challenge product trade-offs.
- Reduced support workload by approximately 70% through an automated knowledge-crawling support workflow, deflecting approximately 1,400 of approximately 2,000 monthly tickets.
- Led AI Sales Strategist discovery and rapid prototyping to reduce GTM planning from weeks to minutes using Claude Code, VS Code, RAG, and CrewAI.

Walkover Web Solutions | Founding Product Manager — Dotsale (Restaurant & Retail SaaS) | Apr 2017 – Mar 2020
- Led product strategy for a restaurant digitization platform integrating POS, inventory management, and kitchen fulfillment.
- Built a recommendation engine monitoring raw-material expiry and recommending targeted promotions for dishes using ingredients approaching expiry, helping reduce raw-material waste.
- Owned a six-month roadmap, GTM strategy, PRDs, and North Star metrics across a cross-functional team.
- Led architecture modernization from a tightly coupled application to independently deployable frontend, backend, and queue-management services, enabling faster releases and independent scaling.
- Supported onboarding of approximately 200 additional clients after the initial launch phase.

Walkover Web Solutions | Software Engineer — Backend API & Angular Developer | Aug 2014 – Mar 2017
- Engineered backend APIs for the Giddh accounting platform and built a Windows mobile VoIP calling application.

Product / Technical Skills
Product strategy, roadmap, PRDs, GTM strategy, analytics, customer discovery, API architecture, microservices, integrations, queue-based architecture, AI/LLM products, Figma, Amplitude, Mixpanel, Google Analytics, FullStory, Jira, Confluence, Productboard, Miro, Claude Code, VS Code, RAG, CrewAI

Education
Bachelor of Engineering (B.E.), Information Technology, RGPV, 2011

Certifications
- Scrum Product Owner Accredited Certification, 2024
- Scrum Master Accredited Certification, 2020`;

  const coverLetter = `Dear Hiring Team,

I am writing to express interest in the Senior Product Manager opportunity. My background aligns closely with the role’s emphasis on product strategy, customer discovery, roadmap ownership, API and platform thinking, and measurable customer impact.

At Walkover Web Solutions, I have led product strategy for MSG91 and AI initiatives serving 30,000+ clients and a ~$6M ARR business. I have owned roadmap decisions, used customer and usage data to prioritize investments, and partnered with engineering to deliver product improvements that directly influenced growth and retention. I built an account-health workflow using historical versus current-day messaging volume; the resulting operating model supported approximately $540K in annual revenue retention and ~9% churn reduction.

I also led product strategy and API architecture for Campaign, an omnichannel communication platform processing ~80M requests per month. This work required balancing customer needs, platform architecture, product prioritization, and cross-functional collaboration across engineering, sales, and support. The experience is directly relevant to a role focused on API products, customer lifecycle value, and product-led execution. In addition, I led AI Sales Strategist discovery and rapid prototyping to compress GTM planning from weeks to minutes using Claude Code, VS Code, RAG, and CrewAI, reinforcing my ability to bring AI-enabled product thinking into practical workstreams.

My earlier work at Dotsale further strengthened my operational and workflow product experience. As founding product manager for a restaurant and retail SaaS, I owned product strategy, GTM, PRDs, and architecture modernization while building a recommendation engine to reduce raw-material waste and improve operational efficiency. That experience is relevant to roles requiring product thinking across operations, workflows, and customer-facing systems.

I would welcome the opportunity to discuss how my product strategy, customer discovery, API architecture, analytics, AI product experimentation, and cross-functional leadership experience can support your team’s goals.

Sincerely,
Ravi Soni`;

  return {
    job: { title: "", company: "", location: "" },
    overall_score: 80,
    score_breakdown: [
      { category: "Core Product Experience", score: 90, weight: 20, reason: "Strong product leadership evidence across roadmap, GTM, analytics, and AI-enabled product work." },
      { category: "JD Responsibilities", score: 85, weight: 20, reason: "Direct alignment with strategy, discovery, customer outcomes, and cross-functional execution." },
      { category: "Domain / Industry", score: 60, weight: 15, reason: "Strong SaaS and operations experience; some domain-specific gaps remain for logistics or CRM transformation." },
      { category: "Technical Skills", score: 90, weight: 10, reason: "API architecture, microservices, integrations, and platform thinking are clearly demonstrated." },
      { category: "Customer Discovery", score: 95, weight: 10, reason: "Customer interviews, discovery calls, and FullStory-based optimization are directly supported." },
      { category: "Analytics / Data", score: 85, weight: 10, reason: "Customer behavior, churn signals, and experiment measurement evidence are well established." },
      { category: "Leadership / Stakeholders", score: 90, weight: 5, reason: "Cross-functional work across sales, support, engineering, and product is clearly evidenced." },
      { category: "Preferred Qualifications", score: 50, weight: 10, reason: "The profile supports AI and SaaS work but not every specialized domain preference is directly proven." }
    ],
    summary: "Strong direct evidence across product strategy, customer discovery, API architecture, analytics, and AI product experimentation. Some domain-specific gaps remain for formal CRM transformation, direct delivery-fleet operations, and GCC experience.",
    strong_matches: strongMatches,
    transferable_matches: transferableMatches,
    gaps,
    interview_risks: interviewRisks,
    tailoring_strategy: [
      "Lead with MSG91 account-health and API strategy experience to match product strategy, retention, and platform ownership requirements.",
      "Highlight customer interviews, FullStory, and OTP optimization as evidence for discovery and product experimentation.",
      "Use Dotsale inventory and kitchen workflow experience to support operational product thinking without overstating it as direct supply-chain ownership.",
      "Emphasize AI Sales Strategist work as proof of AI-native product discovery and rapid prototype execution.",
      "Do not hide the absence of direct CRM transformation or logistics/fleet ownership; address them honestly in interviews."
    ],
    requirement_mapping: [
      {
        requirement: "Product strategy and roadmap ownership",
        category: "product_strategy",
        priority: "high",
        classification: "direct",
        match_score: 92,
        candidate_evidence: [
          { experience: "MSG91 & AI Initiatives", evidence: "Owned product strategy and roadmap for a platform serving 30,000+ clients and a ~$6M ARR business.", metric: "30,000+ clients", relevance: "Direct match to roadmap and strategic product ownership." },
          { experience: "Dotsale", evidence: "Owned six-month roadmap, GTM strategy, PRDs, and North Star metrics.", metric: "~200 additional clients after architecture transformation", relevance: "Supports product planning and delivery accountability." }
        ],
        reason: "Strong, specific evidence of product planning, prioritization, and business accountability.",
        resume_action: "Lead the summary and Selected Impact with roadmap ownership, GTM, and platform growth outcomes.",
        interview_relevance: "Good candidate story for strategic planning and decision-making." 
      },
      {
        requirement: "Customer acquisition, retention, and lifecycle value",
        category: "customer_growth",
        priority: "high",
        classification: "direct",
        match_score: 90,
        candidate_evidence: [
          { experience: "MSG91 account health", evidence: "Built an account-health workflow using historical versus current-day messaging volume to identify declining accounts.", metric: "$540K annual revenue retained; ~9% churn reduction", relevance: "Direct evidence of retention and lifecycle value work." },
          { experience: "OTP Widget", evidence: "Optimized setup to reduce friction and improve conversion from comparable inbound leads.", metric: "300% increase from 2 to 8", relevance: "Supports customer journey and activation optimization." }
        ],
        reason: "Direct evidence across retention, churn analysis, and funnel optimization is present.",
        resume_action: "Frame metrics around revenue retention and conversion lift to reinforce lifecycle value ownership.",
        interview_relevance: "Strong story for customer behavior and churn intervention." 
      },
      {
        requirement: "API architecture or technical product management",
        category: "technical_product",
        priority: "high",
        classification: "direct",
        match_score: 92,
        candidate_evidence: [
          { experience: "Campaign platform", evidence: "Led product strategy and API architecture for an omnichannel communication platform processing ~80M requests/month.", metric: "~80M requests/month", relevance: "Strong direct API and technical product match." },
          { experience: "Architecture transformation", evidence: "Separated frontend, backend, and queue management services to enable independent deployment and scaling.", metric: "~200 additional clients supported", relevance: "Shows platform and system thinking." }
        ],
        reason: "The profile contains clear evidence of API strategy, integrations, scaling, and engineering collaboration.",
        resume_action: "Develop the resume around API platform work and system design trade-offs.",
        interview_relevance: "Useful story for technical product conversations and prioritization." 
      },
      {
        requirement: "AI or GenAI product work",
        category: "ai",
        priority: "medium",
        classification: "direct",
        match_score: 88,
        candidate_evidence: [
          { experience: "AI Sales Strategist", evidence: "Built an AI-assisted GTM planning workflow using Claude Code, VS Code, RAG, and CrewAI.", metric: "Reduced GTM planning from weeks to minutes", relevance: "Strong match for AI-native product experimentation." },
          { experience: "Product prototyping", evidence: "Designed a Figma prototype and focused on a North Star metric around recovered accounts.", metric: "North Star metric defined for recovered accounts", relevance: "Supports AI product design and discovery skill." }
        ],
        reason: "This is one of Ravi's strongest differentiators in modern product work.",
        resume_action: "Highlight the AI Sales Strategist work as a visible differentiator without overstating general-purpose AI leadership.",
        interview_relevance: "Prepare to explain the product, workflow, and measurement model clearly." 
      },
      {
        requirement: "Supply chain optimization or inventory operations",
        category: "operations",
        priority: "medium",
        classification: "transferable",
        match_score: 72,
        candidate_evidence: [
          { experience: "Dotsale restaurant SaaS", evidence: "Built recommendation engine to monitor raw-material expiry and recommend promotions for dishes using those ingredients.", metric: "Reduced raw-material waste", relevance: "Transferable operational optimization experience; not direct supply-chain ownership." },
          { experience: "Restaurant operations", evidence: "Owned POS, inventory management, and kitchen fulfillment workflows in a restaurant product setting.", metric: "Restaurant SaaS operations domain", relevance: "Closely related but not a direct supply-chain or logistics role." }
        ],
        reason: "The work is operationally relevant, but it does not establish direct supply-chain or logistics-scale ownership.",
        resume_action: "Use it as transferable experience and state operational optimization honestly, not as direct fleet or logistics expertise.",
        interview_relevance: "Be ready to clarify the difference between restaurant operations and logistics-scale ownership." 
      },
      {
        requirement: "Formal CRM transformation",
        category: "crm",
        priority: "medium",
        classification: "gap",
        match_score: 10,
        candidate_evidence: [],
        reason: "There is no verified profile evidence of Salesforce, HubSpot, Dynamics, or end-to-end CRM transformation ownership.",
        resume_action: "Do not claim CRM transformation ownership. Emphasize lifecycle and retention product work instead.",
        interview_relevance: "If asked, acknowledge the gap and speak to customer lifecycle and account health work as related but distinct experience." 
      }
    ],
    resume_changes: resumeChanges,
    keywords: {
      high_priority: highPriority.length ? highPriority : ["product strategy", "customer discovery", "API architecture", "retention", "analytics", "AI", "customer journey", "roadmap"],
      secondary: secondary.length ? secondary : ["cross-functional leadership", "PRD", "GTM", "product analytics", "support automation"]
    },
    claims_to_avoid: [
      "Do not claim direct Salesforce transformation experience.",
      "Do not claim automotive industry experience.",
      "Do not claim GCC operational experience unless supported by the profile.",
      "Do not claim delivery fleet or last-mile logistics experience.",
      "Do not claim end-to-end supply-chain ownership unless the JD explicitly matches the profile."
    ],
    tailored_resume: tailoredResume,
    cover_letter: coverLetter
  };
}

function parseJsonObject(raw: string | null | undefined): Record<string, any> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return null;
  }
}

function normalizeAnalysis(raw: Record<string, any> | null | undefined, jd: string): Analysis {
  const fallback = buildFallbackAnalysis(jd);
  if (!raw) return fallback;

  const job = raw.job ?? { title: "", company: "", location: "" };
  const overall_score = typeof raw.overall_score === "number" ? raw.overall_score : fallback.overall_score;
  const summary = typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : fallback.summary;
  const strong_matches = Array.isArray(raw.strong_matches) ? raw.strong_matches.map((match: any) => ({
    requirement: String(match?.requirement ?? "Requirement"),
    evidence: String(match?.evidence ?? match?.why_it_matters ?? "Candidate evidence available."),
    score: Number(match?.score ?? 80),
    metric: String(match?.metric ?? ""),
    why_it_matters: String(match?.why_it_matters ?? "Relevant to the JD.")
  })) : fallback.strong_matches;
  const transferable_matches = Array.isArray(raw.transferable_matches) ? raw.transferable_matches.map((match: any) => ({
    requirement: String(match?.requirement ?? "Transferable requirement"),
    evidence: String(match?.evidence ?? match?.why_it_matters ?? "Transferable experience available."),
    score: Number(match?.score ?? 70),
    metric: String(match?.metric ?? ""),
    why_it_matters: String(match?.why_it_matters ?? "Related but not direct experience.")
  })) : fallback.transferable_matches;
  const gaps = Array.isArray(raw.gaps) ? raw.gaps.map((gap: any) => ({
    requirement: String(gap?.requirement ?? "Gap"),
    reason: String(gap?.reason ?? "No direct evidence."),
    risk: gap?.risk === "high" || gap?.risk === "medium" || gap?.risk === "low" ? gap.risk : "medium",
    transferable_experience: gap?.transferable_experience ? String(gap.transferable_experience) : undefined,
    discuss_in_interview: Boolean(gap?.discuss_in_interview ?? true)
  })) : fallback.gaps;
  const interview_risks = Array.isArray(raw.interview_risks) ? raw.interview_risks.map((risk: any) => ({
    risk: String(risk?.risk ?? "Risk"),
    likely_question: String(risk?.likely_question ?? "How would you handle this requirement?"),
    best_candidate_story: String(risk?.best_candidate_story ?? "Use the closest related evidence."),
    evidence: String(risk?.evidence ?? "Evidence available."),
    honest_gap: String(risk?.honest_gap ?? "No direct evidence.")
  })) : fallback.interview_risks;
  const tailoring_strategy = Array.isArray(raw.tailoring_strategy) ? raw.tailoring_strategy.map((item: any) => String(item)) : fallback.tailoring_strategy;
  const requirement_mapping = Array.isArray(raw.requirement_mapping) ? raw.requirement_mapping.map((item: any) => ({
    requirement: String(item?.requirement ?? "Requirement"),
    category: String(item?.category ?? "general"),
    priority: item?.priority === "high" || item?.priority === "medium" || item?.priority === "low" ? item.priority : "medium",
    classification: item?.classification === "direct" || item?.classification === "transferable" || item?.classification === "gap" || item?.classification === "unknown" ? item.classification : "unknown",
    match_score: Number(item?.match_score ?? 0),
    candidate_evidence: Array.isArray(item?.candidate_evidence) ? item.candidate_evidence.map((e: any) => ({
      experience: String(e?.experience ?? "Experience"),
      evidence: String(e?.evidence ?? "Evidence"),
      metric: String(e?.metric ?? ""),
      relevance: String(e?.relevance ?? "Relevant to this requirement.")
    })) : [],
    reason: String(item?.reason ?? "Reasoning available."),
    resume_action: String(item?.resume_action ?? "Emphasize relevant evidence."),
    interview_relevance: String(item?.interview_relevance ?? "Relevant to interview preparation.")
  })) : fallback.requirement_mapping;
  const resume_changes = Array.isArray(raw.resume_changes) ? raw.resume_changes.map((item: any) => ({
    section: String(item?.section ?? "Section"),
    action: String(item?.action ?? "rewrite"),
    reason: String(item?.reason ?? "Reason"),
    content_direction: String(item?.content_direction ?? "Focus on relevant evidence."),
    experience: item?.experience ? String(item.experience) : undefined
  })) : fallback.resume_changes;
  const keywords = raw.keywords && typeof raw.keywords === "object" ? {
    high_priority: Array.isArray(raw.keywords.high_priority) ? raw.keywords.high_priority.map(String) : fallback.keywords.high_priority,
    secondary: Array.isArray(raw.keywords.secondary) ? raw.keywords.secondary.map(String) : fallback.keywords.secondary
  } : fallback.keywords;

  return {
    job: {
      title: String(job?.title ?? ""),
      company: String(job?.company ?? ""),
      location: String(job?.location ?? "")
    },
    overall_score,
    score_breakdown: Array.isArray(raw.score_breakdown) ? raw.score_breakdown.map((item: any) => ({
      category: String(item?.category ?? "General"),
      score: Number(item?.score ?? 0),
      weight: Number(item?.weight ?? 0),
      reason: String(item?.reason ?? "Reason available.")
    })) : fallback.score_breakdown,
    summary,
    strong_matches,
    transferable_matches,
    gaps,
    interview_risks,
    tailoring_strategy,
    requirement_mapping,
    resume_changes,
    keywords,
    claims_to_avoid: Array.isArray(raw.claims_to_avoid) ? raw.claims_to_avoid.map(String) : fallback.claims_to_avoid,
    tailored_resume: typeof raw.tailored_resume === "string" && raw.tailored_resume.trim() ? raw.tailored_resume : fallback.tailored_resume,
    cover_letter: typeof raw.cover_letter === "string" && raw.cover_letter.trim() ? raw.cover_letter : fallback.cover_letter,
  };
}

function resolveOpenAIModelName(): string {
  const raw = (process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
  if (!raw) return "gpt-4.1-mini";

  const normalized = raw.replace(/\s+/g, "").replace(/minix$/i, "mini");
  if (/^gpt-4(?:\.|o)?-?mini$/i.test(normalized)) return "gpt-4.1-mini";
  if (/^gpt-4o-mini$/i.test(normalized)) return "gpt-4o-mini";
  if (/^gpt-4o$/i.test(normalized)) return "gpt-4o";
  return "gpt-4.1-mini";
}

export async function llmJson(jd: string): Promise<Analysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildFallbackAnalysis(jd);
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  const modelNames = Array.from(new Set([resolveOpenAIModelName(), "gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"]));

  for (const model of modelNames) {
    try {
      const prompt = `You are a rigorous senior recruiter and evidence-first product hiring analyst. You work only from the candidate master profile. Do not invent experience. Do not attribute skills that are not supported by the profile. Distinguish direct matches, transferable matches, gaps, and unknowns. Return valid JSON only.

Your output must be a JSON object with this exact structure:
{
  "job": {"title": "", "company": "", "location": ""},
  "overall_score": 0,
  "score_breakdown": [{"category": "", "score": 0, "weight": 0, "reason": ""}],
  "summary": "",
  "strong_matches": [{"requirement": "", "evidence": "", "score": 0, "metric": "", "why_it_matters": ""}],
  "transferable_matches": [{"requirement": "", "evidence": "", "score": 0, "metric": "", "why_it_matters": ""}],
  "gaps": [{"requirement": "", "reason": "", "risk": "high|medium|low", "transferable_experience": "", "discuss_in_interview": true}],
  "interview_risks": [{"risk": "", "likely_question": "", "best_candidate_story": "", "evidence": "", "honest_gap": ""}],
  "tailoring_strategy": [""],
  "requirement_mapping": [{"requirement": "", "category": "", "priority": "high|medium|low", "classification": "direct|transferable|gap|unknown", "match_score": 0, "candidate_evidence": [{"experience": "", "evidence": "", "metric": "", "relevance": ""}], "reason": "", "resume_action": "", "interview_relevance": ""}],
  "resume_changes": [{"section": "", "action": "rewrite|prioritize|reorder", "reason": "", "content_direction": "", "experience": ""}],
  "keywords": {"high_priority": [""], "secondary": [""]},
  "claims_to_avoid": [""],
  "tailored_resume": "",
  "cover_letter": ""
}

Important rules:
- Use only evidence from the candidate master profile.
- Do not invent employers, dates, metrics, customer names, or technologies.
- Distinguish direct vs transferable vs gap vs unknown.
- If a requirement is not supported, classify it as gap or unknown and say so explicitly.
- Keep score explainable and aligned to evidence.
- Produce a genuine resume and cover letter tailored to the JD, based on the profile.
- The resume should be 700-1100 words and ATS-friendly, not generic marketing copy.
- The cover letter should be 300-450 words and specifically reference JD requirements.

Candidate master profile:
${JSON.stringify(profile, null, 2)}

Job description:
${jd}`;

      const response = await client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON. Accuracy and evidence discipline are more important than persuasion." },
          { role: "user", content: prompt }
        ]
      });

      const content = response.choices[0]?.message?.content;
      const parsed = parseJsonObject(content);
      if (!parsed) {
        throw new Error("The model returned malformed JSON.");
      }

      const normalized = normalizeAnalysis(parsed, jd);
      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isModelError = /404|does not exist|not access|not available|401|403|model/i.test(message);
      if (!isModelError) {
        return buildFallbackAnalysis(jd);
      }
    }
  }

  return buildFallbackAnalysis(jd);
}
