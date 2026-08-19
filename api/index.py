import ipaddress, json, os, re
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document

load_dotenv()
ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = ROOT / "data" / "master_profile.json"
profile = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))

app = FastAPI(title="JD Matcher V1", version="1.0.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class AnalyzeRequest(BaseModel):
    jd_text: str


def clean_text(text: str) -> str:
    text = re.sub(r"\r", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_url(url: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Only public HTTP/HTTPS job URLs are supported")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid job URL")
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError("Private or local URLs are not allowed")
    except ValueError as exc:
        if str(exc) == "Private or local URLs are not allowed":
            raise
    headers = {"User-Agent": "Mozilla/5.0 (compatible; JDMatcher/1.0)"}
    r = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
    r.raise_for_status()
    if len(r.content) > 5_000_000:
        raise ValueError("The job page is too large to process")
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    main = soup.find("main") or soup.find("article") or soup.body
    if not main:
        raise ValueError("Could not find readable page content")
    text = clean_text(main.get_text("\n", strip=True))
    if len(text) < 300:
        raise ValueError("The page did not expose enough readable job-description text. Paste the JD instead.")
    return text


def extract_file(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        from io import BytesIO
        reader = PdfReader(BytesIO(data))
        return clean_text("\n".join(page.extract_text() or "" for page in reader.pages))
    if name.endswith(".docx"):
        from io import BytesIO
        doc = Document(BytesIO(data))
        return clean_text("\n".join(p.text for p in doc.paragraphs))
    if name.endswith(".txt") or name.endswith(".md"):
        return clean_text(data.decode("utf-8", errors="ignore"))
    raise ValueError("Supported uploads: PDF, DOCX, TXT, MD")


def fallback_analysis(jd: str):
    text = jd.lower()
    skills = [
        "product management", "roadmap", "customer discovery", "analytics", "api", "ai", "saas",
        "crm", "mobile", "web", "operations", "logistics", "cybersecurity", "supply chain", "gTM"
    ]
    matched = [s for s in skills if s.lower() in text]
    return {"overall_score": 50, "note": "LLM not configured; keyword-only preliminary result.", "matched_keywords": matched}


def llm_json(jd: str):
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return fallback_analysis(jd)
    client = OpenAI(api_key=key)
    prompt = f"""You are a rigorous senior recruiter and product leadership interviewer.
Analyze the job description against the candidate master profile below.
Do not invent experience. Distinguish direct evidence, transferable evidence, and genuine gaps.
Return valid JSON only with this schema:
{{
  "job_title": string,
  "company": string,
  "location": string,
  "overall_score": integer 0-100,
  "summary": string,
  "strong_matches": [{{"requirement": string, "evidence": string, "score": integer}}],
  "transferable_matches": [{{"requirement": string, "evidence": string, "score": integer}}],
  "gaps": [{{"requirement": string, "reason": string, "risk": "low"|"medium"|"high"}}],
  "keywords_to_emphasize": [string],
  "interview_risks": [string],
  "tailoring_strategy": [string],
  "tailored_resume_markdown": string,
  "cover_letter": string
}}
Candidate master profile:
{json.dumps(profile, ensure_ascii=False, indent=2)}
Job description:
{jd}
"""
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "Return only valid JSON. Accuracy and evidence discipline are more important than persuasion."},
            {"role": "user", "content": prompt},
        ],
    )
    return json.loads(response.choices[0].message.content)


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_configured": bool(os.getenv("OPENAI_API_KEY"))}

@app.get("/api/profile")
def get_profile():
    return profile

@app.post("/api/extract")
async def extract(url: Optional[str] = Form(None), file: Optional[UploadFile] = File(None), jd_text: Optional[str] = Form(None)):
    try:
        if jd_text and jd_text.strip():
            text = clean_text(jd_text)
            source = "pasted"
        elif url:
            text = extract_url(url)
            source = "url"
        elif file:
            data = await file.read()
            if len(data) > 10_000_000:
                raise ValueError("Uploaded files must be 10 MB or smaller")
            text = extract_file(file.filename or "upload", data)
            source = "file"
        else:
            raise ValueError("Provide a URL, pasted JD, or upload a file")
        return {"source": source, "text": text}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    jd = clean_text(req.jd_text)
    if len(jd) < 100:
        raise HTTPException(status_code=400, detail="JD is too short")
    try:
        return llm_json(jd)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")
