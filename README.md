# Funnel Hacker

CLI tool to reverse-engineer competitor funnels with AI-powered analysis.

## What it does

1. **Walk funnels** — Automatically navigate through a funnel, capturing screenshots of each step
2. **AI Analysis** — Use specialized AI "team members" to analyze every aspect
3. **Discover ads** — Find top-performing ads from Facebook Ad Library (coming soon)
4. **Report** — Generate PDF reports with insights (coming soon)

## Installation

```bash
bun install
bunx playwright install chromium
```

## Usage

### Walk a funnel

```bash
# Basic usage
bun run walk https://example.com/landing-page

# With options
bun run walk https://example.com/landing-page --depth 15 --no-headless
```

### Analyze a captured funnel

```bash
# Analyze with all relevant specialists (auto-detected)
bun run dev analyze ./output/2026-03-19T08-30-00

# Analyze with specific specialists
bun run dev analyze ./output/2026-03-19T08-30-00 --specialists=copy,funnel-architect
```

### List available specialists

```bash
bun run dev specialists
```

## The Analysis Team

Funnel Hacker uses specialized AI "team members", each with deep expertise:

| Specialist | Name | Expertise |
|------------|------|-----------|
| `facebook-ad` | Marcus | Ad creative, hooks, audience targeting, performance signals |
| `funnel-architect` | Diana | Page flow, conversion paths, funnel types, friction analysis |
| `email` | Nadia | Email sequences, subject lines, timing, psychological journeys |
| `vsl-presentation` | Victor | Video sales letters, webinars, retention mechanics |
| `copy` | Clara | Headlines, body copy, offers, emotional triggers |
| `head-funnel-hacker` | Jack | Strategic synthesis, business model analysis, actionable insights |

Each specialist has their own detailed prompt in `specialists/*.md` — customize them to improve analysis quality over time.

## Output

### After walking a funnel:

```
output/2026-03-19T08-30-00/
├── step-1.png
├── step-2.png
├── step-3.png
└── funnel.json
```

### After analysis:

```
output/2026-03-19T08-30-00/
├── step-1.png
├── step-2.png
├── step-3.png
├── funnel.json
├── analysis.json           # Structured analysis data
└── analysis-report.md      # Full markdown report
```

## Walk Options

- `-o, --output <dir>` — Output directory (default: `./output`)
- `-d, --depth <number>` — Max pages to capture (default: 10)
- `--headless` / `--no-headless` — Run with visible browser

## Analyze Options

- `-s, --specialists <list>` — Comma-separated specialists (default: auto-detect)
- `-o, --output <format>` — Output format: json, markdown, both (default: both)

## Roadmap

- [x] Phase 1: Basic funnel walking
- [x] Phase 3: AI specialist team
- [ ] Phase 2: Facebook Ad Library integration
- [ ] Phase 4: Email sequence capture
- [ ] Phase 5: PDF report generation

## Tech Stack

- **Bun** — Runtime
- **Playwright** — Browser automation
- **Claude API** — AI analysis (claude-sonnet-4-20250514 with vision)
- **TypeScript** — Type safety

## Customizing Specialists

Each specialist's behavior is defined in `specialists/*.md`. You can:

1. Adjust their analysis frameworks
2. Add industry-specific knowledge
3. Change output formats
4. Fine-tune their personality and focus areas

The specialists are designed to be iteratively improved based on the quality of analysis you need.
