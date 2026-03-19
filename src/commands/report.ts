import { chromium } from "playwright";
import { readFile, writeFile, readdir } from "fs/promises";
import { join, basename } from "path";

interface ReportOptions {
  template: string;
  output?: string;
  title?: string;
}

interface FunnelData {
  startUrl: string;
  startedAt: string;
  completedAt?: string;
  steps: Array<{
    step: number;
    url: string;
    title: string;
    screenshot: string;
  }>;
}

interface AnalysisData {
  analyzedAt: string;
  funnelSource: string;
  fullAnalysis: string;
  specialistReports: Record<string, string>;
}

export async function generateReport(funnelDir: string, options: ReportOptions) {
  console.log(`\n📄 Generating PDF report from: ${funnelDir}`);

  // Load funnel data
  let funnelData: FunnelData | null = null;
  let analysisData: AnalysisData | null = null;
  let adsData: any = null;
  let emailData: any = null;

  try {
    const funnelJson = await readFile(join(funnelDir, "funnel.json"), "utf-8");
    funnelData = JSON.parse(funnelJson);
  } catch {
    console.log("   ℹ️ No funnel.json found");
  }

  try {
    const analysisJson = await readFile(join(funnelDir, "analysis.json"), "utf-8");
    analysisData = JSON.parse(analysisJson);
  } catch {
    console.log("   ℹ️ No analysis.json found");
  }

  try {
    const adsJson = await readFile(join(funnelDir, "ads.json"), "utf-8");
    adsData = JSON.parse(adsJson);
  } catch {
    // No ads data
  }

  try {
    const emailJson = await readFile(join(funnelDir, "email-sequence.json"), "utf-8");
    emailData = JSON.parse(emailJson);
  } catch {
    // No email data
  }

  if (!funnelData && !analysisData && !adsData && !emailData) {
    console.error("❌ No data found to generate report from");
    process.exit(1);
  }

  // Load screenshots as base64 - check multiple possible locations
  const screenshots: Record<string, string> = {};
  if (funnelData) {
    for (const step of funnelData.steps) {
      const possiblePaths = [
        join(funnelDir, step.screenshot),
        join(funnelDir, basename(step.screenshot)),
      ];

      for (const imgPath of possiblePaths) {
        try {
          const imgBuffer = await readFile(imgPath);
          screenshots[step.screenshot] = imgBuffer.toString("base64");
          console.log(`   ✅ Loaded screenshot: ${step.screenshot}`);
          break;
        } catch {
          // Try next path
        }
      }

      if (!screenshots[step.screenshot]) {
        console.log(`   ⚠️ Screenshot not found: ${step.screenshot}`);
      }
    }
  }

  // Load ad screenshots
  if (adsData) {
    for (const ad of adsData.ads || []) {
      if (ad.screenshotPath) {
        try {
          const imgBuffer = await readFile(join(funnelDir, ad.screenshotPath));
          screenshots[ad.screenshotPath] = imgBuffer.toString("base64");
        } catch {
          // Screenshot not found
        }
      }
    }
  }

  // Extract domain for title
  let domain = "Unknown";
  try {
    domain = new URL(funnelData?.startUrl || analysisData?.funnelSource || "").hostname.replace("www.", "");
  } catch {}

  // Generate HTML
  const title = options.title || `${domain} Funnel Analysis`;
  const html = generatePremiumHtmlReport({
    title,
    domain,
    funnelData,
    analysisData,
    adsData,
    emailData,
    screenshots,
    template: options.template,
  });

  // Convert to PDF using Playwright
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "networkidle" });

  const outputPath = options.output || join(funnelDir, "funnel-report.pdf");

  await page.pdf({
    path: outputPath,
    format: "A4",
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
    printBackground: true,
  });

  await browser.close();

  console.log(`\n✨ PDF report generated!`);
  console.log(`   📄 Output: ${outputPath}`);

  return outputPath;
}

interface ReportData {
  title: string;
  domain: string;
  funnelData: FunnelData | null;
  analysisData: AnalysisData | null;
  adsData: any;
  emailData: any;
  screenshots: Record<string, string>;
  template: string;
}

function generatePremiumHtmlReport(data: ReportData): string {
  const { title, domain, funnelData, analysisData, adsData, emailData, screenshots } = data;

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  // Parse the analysis to extract key sections
  let executiveSummary = "";
  let strategicOverview = "";
  let specialistSections: { name: string; content: string; grade?: string }[] = [];
  let actionableSection = "";

  if (analysisData?.fullAnalysis) {
    const analysis = analysisData.fullAnalysis;

    // Extract executive summary
    const execMatch = analysis.match(/\*\*What This Is:\*\*([\s\S]*?)(?=---|\n##)/);
    if (execMatch) {
      executiveSummary = analysis.split("---")[0];
    }

    // Extract grades from specialist reports
    const gradeMatches = analysis.matchAll(/\*\*Grade:\*\*\s*([A-F][+-]?)/g);
    const grades: Record<string, string> = {};
    for (const match of gradeMatches) {
      grades[match.index?.toString() || ""] = match[1];
    }
  }

  // Process markdown with better handling
  const processMarkdown = (md: string) => {
    if (!md) return "";

    return md
      // Headers
      .replace(/^#### (.*$)/gim, '<h4 class="section-h4">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="section-h3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="section-h2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="section-h1">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Code blocks
      .replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```\w*\n?/g, "").replace(/```/g, "");
        return `<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`;
      })
      // Inline code
      .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
      // Tables
      .replace(/\|(.+)\|/g, (match, content) => {
        const cells = content.split("|").map((c: string) => c.trim());
        if (cells.every((c: string) => c.match(/^[-:]+$/))) {
          return ""; // Skip separator rows
        }
        const isHeader = match.includes("---") || content.includes("Metric") || content.includes("Element");
        const tag = isHeader ? "th" : "td";
        return `<tr>${cells.map((c: string) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
      })
      // Horizontal rules
      .replace(/^---$/gim, '<hr class="divider">')
      // Lists
      .replace(/^\d+\.\s+(.*$)/gim, '<li class="numbered">$1</li>')
      .replace(/^[-•]\s+(.*$)/gim, '<li class="bullet">$1</li>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p class="paragraph">')
      .replace(/\n/g, "<br>");
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0f172a;
      --secondary: #1e293b;
      --accent: #3b82f6;
      --accent-light: #60a5fa;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #1e293b;
      --text-light: #64748b;
      --text-muted: #94a3b8;
      --bg: #ffffff;
      --bg-subtle: #f8fafc;
      --bg-muted: #f1f5f9;
      --border: #e2e8f0;
      --border-light: #f1f5f9;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 10pt;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }

    /* ==================== COVER PAGE ==================== */
    .cover {
      height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 60px;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }

    .cover::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -30%;
      width: 80%;
      height: 150%;
      background: radial-gradient(ellipse, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .cover::after {
      content: '';
      position: absolute;
      bottom: -30%;
      left: -20%;
      width: 60%;
      height: 100%;
      background: radial-gradient(ellipse, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
      pointer-events: none;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      position: relative;
      z-index: 1;
    }

    .cover-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .cover-logo-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--accent) 0%, var(--success) 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .cover-logo-text {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .cover-date {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .cover-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      z-index: 1;
    }

    .cover-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 8px 16px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 500;
      color: var(--accent-light);
      margin-bottom: 24px;
      width: fit-content;
    }

    .cover-title {
      font-size: 48px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -2px;
      margin-bottom: 16px;
      max-width: 600px;
    }

    .cover-subtitle {
      font-size: 20px;
      font-weight: 400;
      color: rgba(255,255,255,0.7);
      max-width: 500px;
      line-height: 1.5;
    }

    .cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      position: relative;
      z-index: 1;
    }

    .cover-meta {
      display: flex;
      gap: 40px;
    }

    .cover-meta-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .cover-meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255,255,255,0.5);
    }

    .cover-meta-value {
      font-size: 14px;
      font-weight: 600;
    }

    .cover-team {
      text-align: right;
    }

    .cover-team-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 8px;
    }

    .cover-team-names {
      font-size: 11px;
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
    }

    /* ==================== PAGE LAYOUT ==================== */
    .page {
      padding: 50px 60px;
      min-height: 100vh;
      page-break-after: always;
      position: relative;
    }

    .page::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--accent), var(--success));
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }

    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -1px;
    }

    .page-number {
      font-size: 12px;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* ==================== EXECUTIVE SUMMARY ==================== */
    .exec-summary {
      background: linear-gradient(135deg, var(--bg-subtle) 0%, var(--bg-muted) 100%);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 32px;
    }

    .exec-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      margin-top: 24px;
    }

    .exec-item {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .exec-item-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
      font-weight: 600;
    }

    .exec-item-value {
      font-size: 13px;
      color: var(--text);
      line-height: 1.5;
    }

    .exec-bottom-line {
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      color: white;
      border-radius: 12px;
      padding: 24px;
      margin-top: 24px;
    }

    .exec-bottom-line-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 8px;
      font-weight: 600;
    }

    .exec-bottom-line-text {
      font-size: 14px;
      line-height: 1.6;
    }

    /* ==================== GRADES ==================== */
    .grades-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin: 24px 0;
    }

    .grade-card {
      background: var(--bg-subtle);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid var(--border-light);
    }

    .grade-card-specialist {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .grade-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .grade-a { background: #dcfce7; color: #166534; }
    .grade-b { background: #fef3c7; color: #92400e; }
    .grade-c { background: #fed7aa; color: #9a3412; }
    .grade-d { background: #fecaca; color: #991b1b; }

    .grade-card-insight {
      font-size: 11px;
      color: var(--text-light);
      line-height: 1.4;
    }

    /* ==================== SCREENSHOT GALLERY ==================== */
    .screenshot-section {
      margin: 32px 0;
    }

    .screenshot-card {
      background: var(--bg-subtle);
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 24px;
      border: 1px solid var(--border);
    }

    .screenshot-header {
      padding: 16px 24px;
      background: white;
      border-bottom: 1px solid var(--border-light);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .screenshot-step {
      background: var(--accent);
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
    }

    .screenshot-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
    }

    .screenshot-url {
      font-size: 10px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .screenshot-image {
      width: 100%;
      display: block;
    }

    .screenshot-placeholder {
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-muted);
      color: var(--text-muted);
      font-size: 14px;
    }

    /* ==================== ANALYSIS SECTIONS ==================== */
    .analysis-section {
      margin: 32px 0;
    }

    .section-h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      margin: 32px 0 16px 0;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--accent);
    }

    .section-h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--secondary);
      margin: 24px 0 12px 0;
    }

    .section-h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin: 20px 0 10px 0;
    }

    .paragraph {
      margin: 12px 0;
      line-height: 1.7;
    }

    .highlight-box {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-left: 4px solid var(--accent);
      padding: 20px 24px;
      border-radius: 0 12px 12px 0;
      margin: 20px 0;
    }

    .warning-box {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border-left: 4px solid var(--warning);
      padding: 20px 24px;
      border-radius: 0 12px 12px 0;
      margin: 20px 0;
    }

    .success-box {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-left: 4px solid var(--success);
      padding: 20px 24px;
      border-radius: 0 12px 12px 0;
      margin: 20px 0;
    }

    /* ==================== TABLES ==================== */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11px;
    }

    th {
      background: var(--bg-muted);
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: var(--text);
      border-bottom: 2px solid var(--border);
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-light);
    }

    tr:hover td {
      background: var(--bg-subtle);
    }

    /* ==================== CODE & LISTS ==================== */
    .code-block {
      background: var(--primary);
      color: #e2e8f0;
      padding: 20px;
      border-radius: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      line-height: 1.6;
      overflow-x: auto;
      margin: 16px 0;
    }

    .inline-code {
      background: var(--bg-muted);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
    }

    ul, ol {
      margin: 12px 0 12px 24px;
    }

    li {
      margin: 8px 0;
      line-height: 1.6;
    }

    li.bullet::marker {
      color: var(--accent);
    }

    li.numbered::marker {
      color: var(--accent);
      font-weight: 600;
    }

    .divider {
      border: none;
      height: 1px;
      background: var(--border);
      margin: 32px 0;
    }

    /* ==================== FOOTER ==================== */
    .page-footer {
      position: absolute;
      bottom: 30px;
      left: 60px;
      right: 60px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: var(--text-muted);
      padding-top: 16px;
      border-top: 1px solid var(--border-light);
    }

    /* ==================== PRINT ==================== */
    @media print {
      .page {
        page-break-after: always;
      }

      .screenshot-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <div class="cover">
    <div class="cover-header">
      <div class="cover-logo">
        <div class="cover-logo-icon">🎯</div>
        <div class="cover-logo-text">Funnel Hacker</div>
      </div>
      <div class="cover-date">${currentDate}</div>
    </div>

    <div class="cover-main">
      <div class="cover-badge">
        <span>📊</span>
        <span>Competitive Intelligence Report</span>
      </div>
      <h1 class="cover-title">${escapeHtml(domain)}</h1>
      <p class="cover-subtitle">Complete funnel analysis with AI-powered insights, conversion architecture breakdown, and actionable recommendations.</p>
    </div>

    <div class="cover-footer">
      <div class="cover-meta">
        <div class="cover-meta-item">
          <span class="cover-meta-label">Pages Analyzed</span>
          <span class="cover-meta-value">${funnelData?.steps.length || 0}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Source URL</span>
          <span class="cover-meta-value">${escapeHtml(funnelData?.startUrl?.replace(/^https?:\/\//, '').slice(0, 40) || 'N/A')}</span>
        </div>
      </div>
      <div class="cover-team">
        <div class="cover-team-label">Analysis Team</div>
        <div class="cover-team-names">
          Diana (Funnels) • Clara (Copy)<br>
          Marcus (Ads) • Victor (VSL) • Nadia (Email)<br>
          Jack (Strategy)
        </div>
      </div>
    </div>
  </div>

  ${analysisData ? `
  <!-- ==================== EXECUTIVE SUMMARY ==================== -->
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Executive Summary</h1>
      <span class="page-number">01</span>
    </div>

    <div class="exec-summary">
      ${(() => {
        const analysis = analysisData.fullAnalysis;
        const whatThis = analysis.match(/\*\*What This Is:\*\*\s*([^\n*]+)/)?.[1] || "";
        const whoFor = analysis.match(/\*\*Who It's For:\*\*\s*([^\n*]+)/)?.[1] || "";
        const whatSells = analysis.match(/\*\*What It Sells:\*\*\s*([^\n*]+)/)?.[1] || "";
        const whyWorks = analysis.match(/\*\*Why It Works:\*\*\s*([^\n*]+)/)?.[1] || "";
        const bottomLine = analysis.match(/\*\*Bottom Line:\*\*\s*([^\n*]+)/)?.[1] || "";

        return `
          <div class="exec-grid">
            <div class="exec-item">
              <div class="exec-item-label">What This Is</div>
              <div class="exec-item-value">${escapeHtml(whatThis)}</div>
            </div>
            <div class="exec-item">
              <div class="exec-item-label">Who It's For</div>
              <div class="exec-item-value">${escapeHtml(whoFor)}</div>
            </div>
            <div class="exec-item">
              <div class="exec-item-label">What It Sells</div>
              <div class="exec-item-value">${escapeHtml(whatSells)}</div>
            </div>
            <div class="exec-item">
              <div class="exec-item-label">Why It Works</div>
              <div class="exec-item-value">${escapeHtml(whyWorks)}</div>
            </div>
          </div>
          ${bottomLine ? `
          <div class="exec-bottom-line">
            <div class="exec-bottom-line-label">Bottom Line</div>
            <div class="exec-bottom-line-text">${escapeHtml(bottomLine)}</div>
          </div>
          ` : ''}
        `;
      })()}
    </div>

    ${(() => {
      const analysis = analysisData.fullAnalysis;
      const dianaGrade = analysis.match(/Diana.*?\*\*Grade:\*\*\s*([A-F][+-]?)/s)?.[1];
      const claraGrade = analysis.match(/Clara.*?\*\*Grade:\*\*\s*([A-F][+-]?)/s)?.[1];
      const dianaInsight = analysis.match(/Diana.*?\*\*Key Insight:\*\*\s*([^\n]+)/s)?.[1] || "";
      const claraInsight = analysis.match(/Clara.*?\*\*Key Insight:\*\*\s*([^\n]+)/s)?.[1] || "";

      if (dianaGrade || claraGrade) {
        return `
          <h2 class="section-h2">Specialist Grades</h2>
          <div class="grades-grid">
            ${dianaGrade ? `
            <div class="grade-card">
              <div class="grade-card-specialist">Funnel Architecture</div>
              <div class="grade-badge grade-${dianaGrade[0].toLowerCase()}">${dianaGrade}</div>
              <div class="grade-card-insight">${escapeHtml(dianaInsight.slice(0, 100))}${dianaInsight.length > 100 ? '...' : ''}</div>
            </div>
            ` : ''}
            ${claraGrade ? `
            <div class="grade-card">
              <div class="grade-card-specialist">Copy & Messaging</div>
              <div class="grade-badge grade-${claraGrade[0].toLowerCase()}">${claraGrade}</div>
              <div class="grade-card-insight">${escapeHtml(claraInsight.slice(0, 100))}${claraInsight.length > 100 ? '...' : ''}</div>
            </div>
            ` : ''}
          </div>
        `;
      }
      return '';
    })()}

    <div class="page-footer">
      <span>Funnel Hacker • Competitive Intelligence</span>
      <span>${escapeHtml(domain)}</span>
    </div>
  </div>
  ` : ''}

  ${funnelData && funnelData.steps.length > 0 ? `
  <!-- ==================== FUNNEL SCREENSHOTS ==================== -->
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Funnel Screenshots</h1>
      <span class="page-number">02</span>
    </div>

    <div class="screenshot-section">
      ${funnelData.steps.map((step, index) => `
        <div class="screenshot-card">
          <div class="screenshot-header">
            <div class="screenshot-step">${step.step}</div>
            <div>
              <div class="screenshot-title">${escapeHtml(step.title)}</div>
              <div class="screenshot-url">${escapeHtml(step.url.slice(0, 80))}${step.url.length > 80 ? '...' : ''}</div>
            </div>
          </div>
          ${screenshots[step.screenshot]
            ? `<img src="data:image/png;base64,${screenshots[step.screenshot]}" class="screenshot-image" alt="Step ${step.step}">`
            : `<div class="screenshot-placeholder">Screenshot not available</div>`
          }
        </div>
      `).join('')}
    </div>

    <div class="page-footer">
      <span>Funnel Hacker • Competitive Intelligence</span>
      <span>${escapeHtml(domain)}</span>
    </div>
  </div>
  ` : ''}

  ${analysisData ? `
  <!-- ==================== FULL ANALYSIS ==================== -->
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Strategic Analysis</h1>
      <span class="page-number">03</span>
    </div>

    <div class="analysis-section">
      ${processMarkdown(analysisData.fullAnalysis)}
    </div>

    <div class="page-footer">
      <span>Funnel Hacker • Competitive Intelligence</span>
      <span>${escapeHtml(domain)}</span>
    </div>
  </div>
  ` : ''}

</body>
</html>`;
}
