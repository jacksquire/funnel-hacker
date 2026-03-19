# Funnel Hacker

CLI tool to reverse-engineer competitor funnels.

## What it does

1. **Walk funnels** — Automatically navigate through a funnel, capturing screenshots of each step
2. **Discover ads** — Find top-performing ads from Facebook Ad Library (coming soon)
3. **Analyze** — Use AI to understand why each step works (coming soon)
4. **Report** — Generate PDF reports with insights (coming soon)

## Installation

```bash
bun install
```

## Usage

### Walk a funnel

```bash
# Basic usage
bun run walk https://example.com/landing-page

# With options
bun run walk https://example.com/landing-page --depth 15 --no-headless
```

### Options

- `-o, --output <dir>` — Output directory (default: `./output`)
- `-d, --depth <number>` — Max pages to capture (default: 10)
- `--headless` / `--no-headless` — Run with visible browser

## Output

Each funnel walk creates a timestamped folder with:

```
output/2026-03-19T08-30-00/
├── step-1.png
├── step-2.png
├── step-3.png
└── funnel.json
```

The `funnel.json` contains structured data about each step:

```json
{
  "startUrl": "https://example.com/landing",
  "startedAt": "2026-03-19T08:30:00.000Z",
  "completedAt": "2026-03-19T08:32:15.000Z",
  "steps": [
    {
      "step": 1,
      "url": "https://example.com/landing",
      "title": "Free Training - Learn X",
      "screenshot": "step-1.png",
      "ctaText": "Get Instant Access",
      "forms": ["email, name"]
    }
  ]
}
```

## Roadmap

- [x] Phase 1: Basic funnel walking
- [ ] Phase 2: Facebook Ad Library integration
- [ ] Phase 3: AI analysis (Claude Vision)
- [ ] Phase 4: Email sequence capture
- [ ] Phase 5: PDF report generation

## Tech Stack

- **Bun** — Runtime
- **Playwright** — Browser automation
- **Claude API** — AI analysis
- **TypeScript** — Type safety
