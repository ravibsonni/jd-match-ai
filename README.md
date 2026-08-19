# JD Matcher V1.1

A Vercel-ready Next.js + FastAPI MVP for comparing job descriptions against a verified candidate master profile and generating a tailored resume and cover letter.

## V1 capabilities

- Accept a public job URL, pasted JD, or PDF/DOCX/TXT/MD upload
- Extract readable job-description text
- Compare the JD against `data/master_profile.json`
- Separate direct evidence, transferable evidence, and genuine gaps
- Produce an overall match score and interview risks
- Identify keywords to emphasize
- Generate a tailored resume in Markdown
- Generate a tailored cover letter
- Keep candidate claims evidence-based; the model is instructed not to invent missing experience

## Repository structure

```text
jd-matcher-v1/
├── api/
│   └── index.py              # FastAPI serverless entry point
├── data/
│   └── master_profile.json   # Verified candidate profile and evidence
├── src/
│   └── app/
│       ├── page.tsx          # Main UI
│       ├── layout.tsx        # App metadata/layout
│       └── globals.css       # Styles
├── .env.example
├── .gitignore
├── next.config.mjs
├── next-env.d.ts
├── package.json
├── requirements.txt
├── tsconfig.json
└── README.md
```

## Deploy to Vercel

### 1. Push to GitHub

Create a GitHub repository and push the contents of this directory. Do **not** commit `.env` or any API key.

```bash
git init
git add .
git commit -m "Initial JD Matcher V1.1"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Import into Vercel

- Open Vercel
- Select **Add New → Project**
- Import the GitHub repository
- Let Vercel detect Next.js
- Deploy

The Next.js frontend and FastAPI API are intentionally deployed as one project and one origin.

### 3. Add environment variables

In **Vercel → Project → Settings → Environment Variables**, add:

```text
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

Do not expose `OPENAI_API_KEY` through a `NEXT_PUBLIC_*` variable.

Redeploy after adding or changing environment variables.

### 4. Verify

Open:

- `/` — application
- `/api/health` — API health check

Expected health response:

```json
{"status":"ok","llm_configured":true}
```

## Local development

Requirements:

- Node.js 18+
- Python 3.10+
- An OpenAI API key

Install frontend dependencies:

```bash
npm install
```

Create local environment file:

```bash
copy .env.example .env.local
```

Install Python dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

For local development, the simplest approach is to run FastAPI separately on port 8000 and set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`; the current UI uses same-origin `/api/...` routes for Vercel deployment. Alternatively use `vercel dev` for a Vercel-style local environment.

## API endpoints

### `GET /api/health`

Checks API availability and whether the OpenAI key is configured.

### `GET /api/profile`

Returns the current master profile.

### `POST /api/extract`

Accepts one of:

- `url`
- `file`
- `jd_text`

Returns normalized JD text.

### `POST /api/analyze`

Request:

```json
{"jd_text":"..."}
```

Returns match analysis, gaps, tailoring strategy, tailored resume Markdown, and cover letter.

## Important V1 limitations

- Public job pages can block automated extraction. Paste the JD when URL extraction fails.
- Scanned/image-only PDFs require OCR, which is not included in V1.
- Generated resume and cover letter are Markdown in V1. Review them before applying.
- Google Sheets/application tracking is intentionally deferred to V2.
- Authentication and multi-user support are not included in V1.
- The master profile is currently stored as JSON; V2 should add a profile editor and persistent database.

## Safety / accuracy

The application is designed to prefer evidence over keyword stuffing. It explicitly distinguishes direct evidence, transferable evidence, and gaps. Do not claim a skill or experience unless it is supported by the master profile.

## Roadmap

### V1.1
- Clean Vercel/GitHub repository
- Stable same-origin API routing
- Verified candidate profile

### V2
- Master Profile Editor
- Google Sheets application tracker
- Application status and history
- PDF/DOCX resume generation
- Better JD parsing and structured requirement extraction
- Interview-question generation from identified gaps


## Input modes

The **Analyze & Tailor** button accepts any one of these sources:

1. Job URL — public HTTP/HTTPS URL
2. Upload JD — PDF, DOCX, TXT, or MD
3. Paste JD — plain text

If a URL or file is selected and no pasted JD is present, the app automatically extracts the JD before analysis.

## Vercel routing

The project uses Vercel's native Next.js + Python layout. `api/index.py` is the FastAPI entry point and exposes `/api/extract`, `/api/analyze`, `/api/health`, and `/api/profile`. No custom `vercel.json` rewrite is required.


## API verification

After deployment, test these endpoints in order:

- `GET /api` — confirms Vercel routed the Python function
- `GET /api/health` — confirms FastAPI is running
- `GET /api/profile` — confirms the master profile loads
- `POST /api/extract` — accepts `url`, `file`, or `jd_text`
- `POST /api/analyze` — accepts JSON `{ "jd_text": "..." }`

If `/api` itself returns 404, check the Vercel Project Root Directory: it must point to the repository root containing both `api/` and `src/`.
