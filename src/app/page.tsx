"use client";

import { useState } from "react";

type Analysis = {
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

export default function Page() {
  const [url, setUrl] = useState("");
  const [jd, setJd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Analysis | null>(null);

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
    if (jd.trim().length < 100) {
      setStatus("Paste or load a job description first.");
      return;
    }
    setLoading(true);
    setStatus("Analyzing fit and generating tailored documents…");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_text: jd })
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
          <div className="eyebrow">JOB SEARCH COPILOT · V1</div>
          <h1>JD Matcher</h1>
          <p>
            Paste a JD or public job URL. Compare it against your verified master profile,
            identify gaps, and generate a tailored application.
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
            <button className="primary" onClick={analyze} disabled={loading || jd.length < 100}>
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
                <h2>
                  {result.job_title || "Role"}
                  {result.company ? ` · ${result.company}` : ""}
                </h2>
                <p>{result.summary}</p>
              </div>
            </div>

            <div className="grid">
              <Panel
                title="Strong matches"
                items={result.strong_matches.map((item) => `${item.requirement}: ${item.evidence}`)}
                good
              />
              <Panel
                title="Transferable matches"
                items={result.transferable_matches.map(
                  (item) => `${item.requirement}: ${item.evidence}`
                )}
              />
              <Panel
                title="Gaps / risks"
                items={result.gaps.map(
                  (item) => `${item.requirement} — ${item.reason} (${item.risk})`
                )}
                bad
              />
              <Panel title="Interview risks" items={result.interview_risks} />
            </div>

            <div className="card">
              <h2>Tailoring strategy</h2>
              <ul>
                {result.tailoring_strategy.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <h2>Keywords to emphasize</h2>
              <div className="tags">
                {result.keywords_to_emphasize.map((item, index) => (
                  <span key={index}>{item}</span>
                ))}
              </div>
            </div>

            <div className="grid">
              <div className="card">
                <h2>Tailored resume</h2>
                <button
                  onClick={() => download("tailored-resume.md", result.tailored_resume_markdown)}
                >
                  Download Markdown
                </button>
                <pre>{result.tailored_resume_markdown}</pre>
              </div>
              <div className="card">
                <h2>Cover letter</h2>
                <button onClick={() => download("cover-letter.md", result.cover_letter)}>
                  Download Markdown
                </button>
                <pre>{result.cover_letter}</pre>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Panel({
  title,
  items,
  good,
  bad
}: {
  title: string;
  items: string[];
  good?: boolean;
  bad?: boolean;
}) {
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
