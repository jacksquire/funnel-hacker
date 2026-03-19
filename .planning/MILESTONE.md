# Funnel Hacker - GSD Milestone

## Vision
A CLI tool that reverse-engineers competitor funnels by:
1. Discovering top-performing ads from Facebook Ad Library
2. Walking through funnels step-by-step with automated screenshots
3. Capturing email sequences (optional)
4. Generating comprehensive analysis reports (JSON + PDF)

## User Story
```
As a marketer/founder,
I want to analyze a competitor's complete funnel
So that I can understand what's working and apply insights to my own funnels
```

## Success Criteria
- [ ] Can input a Facebook page/advertiser and get their top ads
- [ ] Can walk a funnel URL and capture every page automatically
- [ ] Generates structured JSON with all funnel data
- [ ] Produces PDF report with analysis and recommendations
- [ ] Works headless (no manual intervention required)

---

## Phase 1: Foundation (MVP)
**Goal:** Basic funnel walking and screenshot capture

### Requirements
1. CLI accepts a starting URL
2. Playwright walks the funnel, clicking CTAs
3. Screenshots saved for each step
4. Basic JSON output with page data

### Deliverables
- `funnel-hacker walk <url>` command
- Screenshots in `output/<timestamp>/`
- `funnel.json` with page metadata

---

## Phase 2: Ad Discovery
**Goal:** Find and analyze ads from Facebook Ad Library

### Requirements
1. Search Facebook Ad Library by page/advertiser
2. Extract ad creatives, copy, dates, status
3. Identify longest-running ads (likely top performers)
4. Link ads to their landing pages

### Deliverables
- `funnel-hacker ads <page-name>` command
- `ads.json` with ad data
- Auto-trigger funnel walk on ad landing pages

---

## Phase 3: AI Analysis
**Goal:** Intelligent funnel breakdown

### Requirements
1. Send screenshots to Claude Vision
2. Analyze each step: copy, design, psychology
3. Identify funnel type (webinar, VSL, quiz, etc.)
4. Generate insights: what works, what doesn't

### Deliverables
- `analysis.json` with AI insights per step
- Funnel flow diagram (mermaid or similar)
- Recommendations section

---

## Phase 4: Email Capture (Optional)
**Goal:** Track email sequences

### Requirements
1. Connect throwaway email (or dedicated inbox)
2. Sign up through funnel
3. Capture and log all follow-up emails
4. Analyze email sequence timing and content

### Deliverables
- `emails.json` with captured sequences
- Email timeline visualization
- Subject line and CTA analysis

---

## Phase 5: PDF Reports
**Goal:** Polished, shareable output

### Requirements
1. Generate branded PDF report
2. Include all screenshots with annotations
3. Executive summary
4. Detailed step-by-step breakdown
5. Competitor comparison template

### Deliverables
- `report.pdf` - full funnel analysis
- Template system for custom branding
- Export to Google Docs (optional)

---

## Tech Stack
- **Runtime:** Bun
- **Language:** TypeScript
- **Browser:** Playwright
- **AI:** Claude API (claude-sonnet-4-20250514 for vision)
- **PDF:** react-pdf or puppeteer-pdf
- **Storage:** Local filesystem + optional S3

## Architecture
```
src/
├── cli.ts                 # Commander-based CLI
├── commands/
│   ├── walk.ts           # Funnel walking
│   ├── ads.ts            # Ad discovery
│   └── report.ts         # Report generation
├── lib/
│   ├── browser.ts        # Playwright setup
│   ├── scraper.ts        # Page data extraction
│   ├── analyzer.ts       # Claude API calls
│   └── pdf.ts            # Report generation
├── types/
│   └── index.ts          # TypeScript types
└── templates/
    └── report.tsx        # PDF template
```

## Open Questions
1. Facebook Ad Library rate limits / anti-bot measures?
2. How to handle multi-path funnels (A/B tests)?
3. Email capture: use temp email service or real inbox?
4. Should we track pricing pages / checkout flows?

---

## Next Action
Start Phase 1: Build basic funnel walker with Playwright
