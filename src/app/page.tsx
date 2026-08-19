"use client";

import { useState } from "react";

type StrongMatch = {
  requirement: string;
  evidence: string;
  score: number;
  metric?: string;
  why_it_matters?: string;
};

type TransferableMatch = StrongMatch;

type Gap = {
  requirement: string;
  reason: string;
  risk: "high" | "medium" | "low";
  transferable_experience?: string;
  discuss_in_interview: boolean;
};

type InterviewRisk = {
  risk: string;
  likely_question: string;
  best_candidate_story: string;
  evidence: string;
  honest_gap: string;
};

type ResumeChange = {
  section: string;
  action: string;
  reason: string;
  content_direction: string;
  experience?: string;
};

type RequirementMapping = {
  requirement: string;
  category: string;
  priority: "high" | "medium" | "low";
  classification: "direct" | "transferable" | "gap" | "unknown";
  match_score: number;
  candidate_evidence: Array<{
    experience: string;
    evidence: string;
    metric: string;
    relevance: string;
  }>;
  reason: string;
  resume_action: string;
  interview_relevance: string;
};

type Analysis = {
  job: { title: string; company: string; location: string };
  overall_score: number;
  score_label: string;
  evidence_confidence: number;
  apply_recommendation: "STRONG_APPLY" | "APPLY" | "SELECTIVE_APPLY" | "STRETCH" | "LOW_PRIORITY";
  why_apply: string[];
  why_not: string[];
  score_breakdown: Array<{ category: string; score: number; weight: number; reason: string }>;
  summary: string;
  strong_matches: StrongMatch[];
  transferable_matches: TransferableMatch[];
  gaps: Gap[];
  interview_risks: InterviewRisk[];
  tailoring_strategy: string[];
  requirement_mapping: RequirementMapping[];
  requirement_evidence: RequirementMapping[];
  resume_changes: ResumeChange[];
  selected_impact: string[];
  keywords: { high_priority: string[]; secondary: string[] };
  claims_to_avoid: string[];
  tailored_resume: string;
  cover_letter: string;
};

export default function Page() {
  const [url, setUrl] = useState("");
  const [jd, setJd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);

  const hasSource = Boolean(url.trim() || file || jd.trim());

  async function loadJD() {
    setLoading(true);
    setStatus("Extracting job description…");
    try {
      const fd = new FormData();
      if (url.trim()) fd.append("url", url.trim());
      if (file) fd.append("file", file);
      if (jd.trim()) fd.append("jd_text", jd.trim());

      const response = await fetch("/api/extract", { method: "POST", body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Extraction failed");
      setJd(data.text);
      setStatus(`Loaded from ${data.source}. Ready to analyze.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    setLoading(true);
    setStatus("Preparing job description…");
    try {
      let analysisJD = jd.trim();

      if (analysisJD.length < 100 && (url.trim() || file)) {
        const fd = new FormData();
        if (url.trim()) fd.append("url", url.trim());
        if (file) fd.append("file", file);

        const extractResponse = await fetch("/api/extract", { method: "POST", body: fd });
        const extractData = await extractResponse.json();
        if (!extractResponse.ok) {
          throw new Error(extractData.detail || "Could not load the job description");
        }

        analysisJD = String(extractData.text || "").trim();
        setJd(analysisJD);
        setStatus(`Loaded from ${extractData.source}. Analyzing…`);
      }

      if (analysisJD.length < 100) {
        throw new Error("Provide a job URL, upload a JD, or paste at least 100 characters of the JD.");
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_text: analysisJD })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Analysis failed");
      setResult(data);
      setStatus("Analysis complete.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function download(name: string, text: string) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <main>
      <div className="shell">
        <header>
          <div className="eyebrow">JOB SEARCH COPILOT · V1.5</div>
          <h1>JD Matcher</h1>
          <p>
            Evidence-based tailoring for product and technical roles. The system matches JD requirements against your verified profile and flags gaps instead of inventing experience.
          </p>
        </header>

        <section className="card input">
          <label>Job URL</label>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://company.com/careers/product-manager"
          />
          <div className="or">or</div>
          <label>Upload JD</label>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <label>Paste JD</label>
          <textarea
            value={jd}
            onChange={(event) => setJd(event.target.value)}
            placeholder="Paste the job description here…"
            rows={10}
          />
          <div className="actions">
            <button onClick={loadJD} disabled={loading}>
              {loading ? "Working…" : "Load JD"}
            </button>
            <button className="primary" onClick={analyze} disabled={loading || !hasSource}>
              {loading ? "Analyzing…" : "Analyze & Tailor"}
            </button>
          </div>
          <div className="status">{status}</div>
        </section>

        {result && (
          <section className="results">
            <div className="score card">
              <div>
                <div className="eyebrow">MATCH SCORE</div>
                <div className="big">{result.overall_score}%</div>
                <h2>{result.score_label}</h2>
                <p>{result.summary}</p>
                <div className="meta-grid">
                  <div><strong>Evidence confidence</strong><br />{result.evidence_confidence}%</div>
                  <div><strong>Apply recommendation</strong><br />{result.apply_recommendation}</div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Why Ravi should apply</h2>
              <ul>
                {result.why_apply.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>

            <div className="card">
              <h2>Why Ravi may not be a fit</h2>
              <ul>
                {result.why_not.map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            </div>

            <div className="card">
              <h3>Why this score?</h3>
              <p className="muted">
                {result.summary}
              </p>
              <div className="breakdown-grid">
                {result.score_breakdown.map((item) => (
                  <div key={item.category} className="breakdown-item">
                    <div className="breakdown-row">
                      <span>{item.category}</span>
                      <strong>{item.score}%</strong>
                    </div>
                    <div className="small">Weight: {item.weight}%</div>
                    <div className="small muted">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Requirement → Evidence</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Requirement</th>
                      <th>Classification</th>
                      <th>Evidence</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.requirement_mapping.map((item) => (
                      <tr key={item.requirement}>
                        <td>{item.requirement}</td>
                        <td>{item.classification}</td>
                        <td>
                          {item.candidate_evidence.length > 0
                            ? item.candidate_evidence.map((e) => `${e.experience}: ${e.evidence}`).join(" | ")
                            : item.reason}
                        </td>
                        <td>{item.match_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid">
              <Panel
                title="Strong matches"
                items={result.strong_matches.map((item) => `${item.requirement} — ${item.evidence} (${item.metric || item.score + "%"})`)}
                good
              />
              <Panel
                title="Transferable matches"
                items={result.transferable_matches.map((item) => `${item.requirement} — ${item.evidence} (${item.metric || item.score + "%"})`)}
              />
              <Panel
                title="Gaps"
                items={result.gaps.map((item) => `${item.requirement} — ${item.reason} (${item.risk})`)}
                bad
              />
              <Panel
                title="Interview risks"
                items={result.interview_risks.map((item) => `${item.risk}: ${item.likely_question}`)}
              />
            </div>

            <div className="card">
              <h2>Tailoring strategy</h2>
              <ul>
                {result.tailoring_strategy.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2>Resume changes</h2>
              <ul>
                {result.resume_changes.map((item, index) => (
                  <li key={index}>
                    <strong>{item.section}</strong> — {item.action}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2>Keywords</h2>
              <div className="keyword-section">
                <div>
                  <h3>High priority</h3>
                  <div className="tags">
                    {result.keywords.high_priority.map((keyword, index) => <span key={index}>{keyword}</span>)}
                  </div>
                </div>
                <div>
                  <h3>Secondary</h3>
                  <div className="tags">
                    {result.keywords.secondary.map((keyword, index) => <span key={index}>{keyword}</span>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Claims to Avoid</h2>
              <ul>
                {result.claims_to_avoid.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2>Tailored resume</h2>
              <button onClick={() => download("tailored-resume.md", result.tailored_resume)}>Download Markdown</button>
              <pre>{result.tailored_resume}</pre>
            </div>

            <div className="card">
              <h2>Cover letter</h2>
              <button onClick={() => download("cover-letter.md", result.cover_letter)}>Download Markdown</button>
              <pre>{result.cover_letter}</pre>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Panel({ title, items, good, bad }: { title: string; items: string[]; good?: boolean; bad?: boolean }) {
  return (
    <div className={`card panel ${good ? "good" : ""} ${bad ? "bad" : ""}`}>
      <h2>{title}</h2>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
