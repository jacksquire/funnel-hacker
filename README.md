# 🎯 Funnel Hacker

> AI-powered competitive intelligence for marketing funnels

Reverse-engineer any competitor's funnel in minutes. Capture pages, analyze Facebook ads, decode email sequences, and get actionable insights from a team of AI specialists.

## What It Does

```
funnel-hacker hack https://competitor.com/landing-page
```

1. **Captures** every page in the funnel with full screenshots
2. **Discovers** their Facebook ads (optional)
3. **Analyzes** everything with 6 AI specialists
4. **Generates** a comprehensive PDF report

## The Analysis Team

Your funnel gets reviewed by a team of AI specialists, each with deep expertise:

| Specialist | Name | Expertise |
|------------|------|-----------|
| 📢 Facebook Ads | Marcus | Ad creative, hooks, targeting signals, performance indicators |
| 🏗️ Funnel Architecture | Diana | Page flow, conversion paths, friction analysis, funnel economics |
| 📧 Email Sequences | Nadia | Subject lines, timing, psychological journey mapping |
| 🎬 VSL/Presentations | Victor | Video structure, retention mechanics, pitch analysis |
| ✍️ Copy | Clara | Headlines, proof stacks, offer construction, emotional triggers |
| 🎯 Strategy | Jack | Business model, competitive positioning, actionable synthesis |

Each specialist cites specific data and benchmarks (not just opinions):
- CTR benchmarks from Meta, WordStream, Unbounce
- Conversion data from Baymard Institute, HubSpot
- Copy research from CoSchedule, Conductor, CXL Institute
- Video retention data from Wistia, Vidyard

## Installation

```bash
# Clone the repo
git clone https://github.com/jacksquire/funnel-hacker.git
cd funnel-hacker

# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium

# Set up your Anthropic API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Quick Start

### Full Hack (Recommended)

```bash
# Complete analysis: capture + analyze + PDF report
bun run hack https://example.com/landing-page

# Include Facebook ad discovery
bun run hack https://example.com/landing-page --include-ads

# Watch the browser (non-headless)
bun run hack https://example.com/landing-page --no-headless
```

### Individual Commands

```bash
# Just capture the funnel
bun run walk https://example.com/landing-page

# Just analyze a captured funnel
bun run analyze ./output/2024-01-15T10-30-00

# Just discover Facebook ads
bun run ads "competitor name"

# Just generate PDF from existing analysis
bun run report ./output/2024-01-15T10-30-00

# Capture email sequence (experimental)
bun run emails https://example.com/optin --temp-email
```

## Output

```
output/hack-2024-01-15T10-30-00/
├── step-1.png              # Full-page screenshot
├── step-2.png
├── step-3.png
├── funnel.json             # Structured page data
├── ads.json                # Facebook ad data (if --include-ads)
├── analysis.json           # AI analysis results
├── analysis-report.md      # Full markdown report
└── funnel-report.pdf       # Shareable PDF report
```

## Example Output

Here's what a typical analysis includes:

### Executive Summary
```
What This Is: A classic webinar funnel for B2B SaaS
Who It's For: Marketing managers at mid-size companies
What It Sells: $2,997 annual software subscription
Why It Works: Strong authority positioning + urgency mechanics
Bottom Line: Model the education-first approach, skip the fake scarcity
```

### Specialist Grades
```
Funnel Architecture (Diana): A-
  "Textbook webinar sequence with smart value stacking"

Copy (Clara): B
  "Level 4 market sophistication, but headlines lack specificity"

Email (Nadia): B+
  "Strong subject lines (38% avg open), weak CTAs"
```

### Steal-Worthy Tactics
```
1. Quiz segmentation before webinar registration (+15% show rate)
2. "Save my seat" language vs "Register" (+23% CTR per CoSchedule)
3. 3-email reminder sequence with increasing urgency
```

## Customizing Specialists

Each specialist is defined in `specialists/*.md`. You can:

- Add industry-specific benchmarks
- Adjust analysis frameworks
- Change output formats
- Add new data sources

Example: Add e-commerce benchmarks to `specialists/funnel-architect.md`

## Commands Reference

| Command | Description |
|---------|-------------|
| `hack <url>` | Full pipeline: capture + analyze + PDF |
| `walk <url>` | Capture funnel screenshots |
| `ads <query>` | Discover Facebook ads |
| `emails <url>` | Sign up and capture email sequence |
| `analyze <dir>` | Run AI analysis on captured data |
| `report <dir>` | Generate PDF report |
| `specialists` | List available AI specialists |
| `stats <dir>` | Quick stats from output directory |

## Options

### hack
- `--include-ads` — Also discover Facebook ads
- `--ads-query <query>` — Custom query for ad search
- `--skip-analysis` — Skip AI analysis
- `--skip-pdf` — Skip PDF generation
- `--depth <n>` — Max funnel pages (default: 10)
- `--no-headless` — Show browser window

### walk
- `--depth <n>` — Max pages to capture
- `--no-headless` — Show browser window

### ads
- `--limit <n>` — Max ads to capture
- `--country <code>` — Country filter (default: US)

### analyze
- `--specialists <list>` — Comma-separated specialist list

## Tech Stack

- **Bun** — Fast JavaScript runtime
- **Playwright** — Browser automation
- **Claude API** — AI analysis (claude-sonnet-4-20250514)
- **TypeScript** — Type safety

## Requirements

- Bun 1.0+
- Anthropic API key
- ~500MB disk space (Playwright browsers)

## Limitations

- Facebook Ad Library scraping may be rate-limited
- Email capture requires temp email service or manual forwarding
- Video analysis is screenshot-based (no audio transcription yet)
- Some funnels block automated browsers

## Roadmap

- [x] Funnel capture with screenshots
- [x] AI specialist analysis team
- [x] Facebook Ad Library integration
- [x] PDF report generation
- [x] Email sequence capture (basic)
- [ ] Video transcription and analysis
- [ ] Chrome extension for manual capture
- [ ] Team collaboration features
- [ ] Historical funnel tracking

## License

MIT

## Credits

Built with Claude Code by [Jack Squire](https://twitter.com/jacksquire_)

Specialist frameworks inspired by:
- Russell Brunson (ClickFunnels, funnel architecture)
- Eugene Schwartz (market sophistication, copy)
- Gary Halbert (direct response copy)
- André Chaperon (email sequences)
