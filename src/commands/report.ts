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

  // Load screenshots as base64
  const screenshots: Record<string, string> = {};
  if (funnelData) {
    for (const step of funnelData.steps) {
      try {
        const imgBuffer = await readFile(join(funnelDir, step.screenshot));
        screenshots[step.screenshot] = imgBuffer.toString("base64");
      } catch {
        // Screenshot not found
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

  // Generate HTML
  const title = options.title || `Funnel Analysis: ${funnelData?.startUrl || "Unknown"}`;
  const html = generateHtmlReport({
    title,
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
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    printBackground: true,
  });

  await browser.close();

  console.log(`\n✨ PDF report generated!`);
  console.log(`   📄 Output: ${outputPath}`);

  return outputPath;
}

interface ReportData {
  title: string;
  funnelData: FunnelData | null;
  analysisData: AnalysisData | null;
  adsData: any;
  emailData: any;
  screenshots: Record<string, string>;
  template: string;
}

function generateHtmlReport(data: ReportData): string {
  const { title, funnelData, analysisData, adsData, emailData, screenshots } = data;

  // Convert markdown to simple HTML
  const markdownToHtml = (md: string) => {
    return md
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, "<code>$1</code>")
      .replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```\w*\n?/g, "").replace(/```/g, "");
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      })
      .replace(/^\- (.*$)/gim, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)\n(?=<li>)/g, "$1")
      .replace(/(<li>.*<\/li>)+/g, "<ul>$&</ul>")
      .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/\|.*\|/g, (match) => {
        const cells = match.split("|").filter(Boolean);
        const row = cells.map((c) => `<td>${c.trim()}</td>`).join("");
        return `<tr>${row}</tr>`;
      });
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: white;
    }

    .cover {
      page-break-after: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 40px;
    }

    .cover h1 {
      font-size: 32pt;
      font-weight: 700;
      margin-bottom: 20px;
    }

    .cover .subtitle {
      font-size: 14pt;
      opacity: 0.9;
      margin-bottom: 40px;
    }

    .cover .meta {
      font-size: 10pt;
      opacity: 0.7;
    }

    .cover .logo {
      font-size: 48pt;
      margin-bottom: 30px;
    }

    .content {
      padding: 20px 0;
    }

    h1 {
      font-size: 24pt;
      color: #1a1a2e;
      margin: 30px 0 15px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e94560;
    }

    h2 {
      font-size: 16pt;
      color: #16213e;
      margin: 25px 0 12px 0;
    }

    h3 {
      font-size: 13pt;
      color: #0f3460;
      margin: 20px 0 10px 0;
    }

    p {
      margin: 10px 0;
    }

    ul, ol {
      margin: 10px 0 10px 25px;
    }

    li {
      margin: 5px 0;
    }

    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 9pt;
    }

    pre {
      background: #1a1a2e;
      color: #e4e4e4;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 15px 0;
    }

    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }

    th {
      background: #f4f4f4;
      font-weight: 600;
    }

    .screenshot {
      max-width: 100%;
      border: 1px solid #ddd;
      border-radius: 8px;
      margin: 15px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .step-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      background: #fafafa;
      page-break-inside: avoid;
    }

    .step-card h3 {
      margin-top: 0;
    }

    .grade {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 10pt;
    }

    .grade-a { background: #4ade80; color: #166534; }
    .grade-b { background: #a3e635; color: #3f6212; }
    .grade-c { background: #fbbf24; color: #92400e; }
    .grade-d { background: #fb923c; color: #9a3412; }
    .grade-f { background: #f87171; color: #991b1b; }

    .highlight-box {
      background: #e0f2fe;
      border-left: 4px solid #0284c7;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }

    .warning-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }

    .toc {
      background: #f8fafc;
      padding: 20px 30px;
      border-radius: 8px;
      margin: 20px 0;
    }

    .toc h2 {
      margin-top: 0;
    }

    .toc ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .toc li {
      padding: 5px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .footer {
      text-align: center;
      font-size: 9pt;
      color: #666;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }

    @media print {
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <!-- Cover Page -->
  <div class="cover">
    <div class="logo">🎯</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">Competitive Funnel Intelligence Report</div>
    <div class="meta">
      Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      <br>
      By Funnel Hacker AI Analysis Team
    </div>
  </div>

  <div class="content">
    <!-- Table of Contents -->
    <div class="toc">
      <h2>Contents</h2>
      <ul>
        ${analysisData ? "<li>Executive Summary</li>" : ""}
        ${funnelData ? "<li>Funnel Overview</li>" : ""}
        ${funnelData ? "<li>Page-by-Page Breakdown</li>" : ""}
        ${analysisData ? "<li>Strategic Analysis</li>" : ""}
        ${adsData ? "<li>Ad Library Analysis</li>" : ""}
        ${emailData ? "<li>Email Sequence Analysis</li>" : ""}
        <li>Actionable Recommendations</li>
      </ul>
    </div>

    ${
      analysisData
        ? `
    <!-- Executive Summary -->
    <h1>Executive Summary</h1>
    <div class="highlight-box">
      ${markdownToHtml(analysisData.fullAnalysis.split("---")[0] || analysisData.fullAnalysis.slice(0, 2000))}
    </div>
    `
        : ""
    }

    ${
      funnelData
        ? `
    <!-- Funnel Overview -->
    <h1 class="page-break">Funnel Overview</h1>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Starting URL</td><td>${escapeHtml(funnelData.startUrl)}</td></tr>
      <tr><td>Total Steps</td><td>${funnelData.steps.length}</td></tr>
      <tr><td>Captured</td><td>${new Date(funnelData.startedAt).toLocaleDateString()}</td></tr>
    </table>

    <!-- Page by Page -->
    <h1 class="page-break">Page-by-Page Breakdown</h1>
    ${funnelData.steps
      .map(
        (step) => `
    <div class="step-card">
      <h3>Step ${step.step}: ${escapeHtml(step.title)}</h3>
      <p><strong>URL:</strong> ${escapeHtml(step.url)}</p>
      ${
        screenshots[step.screenshot]
          ? `<img src="data:image/png;base64,${screenshots[step.screenshot]}" class="screenshot" alt="Step ${step.step} screenshot">`
          : ""
      }
    </div>
    `
      )
      .join("")}
    `
        : ""
    }

    ${
      analysisData
        ? `
    <!-- Full Analysis -->
    <h1 class="page-break">Strategic Analysis</h1>
    ${markdownToHtml(analysisData.fullAnalysis)}

    ${Object.entries(analysisData.specialistReports || {})
      .map(
        ([specialist, report]) => `
    <h2 class="page-break">${specialist.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Report</h2>
    ${markdownToHtml(report)}
    `
      )
      .join("")}
    `
        : ""
    }

    ${
      adsData
        ? `
    <!-- Ads Analysis -->
    <h1 class="page-break">Ad Library Analysis</h1>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Query</td><td>${escapeHtml(adsData.query || "")}</td></tr>
      <tr><td>Total Ads Found</td><td>${adsData.totalFound || 0}</td></tr>
      <tr><td>Active Ads</td><td>${(adsData.ads || []).filter((a: any) => a.status === "active").length}</td></tr>
    </table>

    <h2>Top Ads</h2>
    ${(adsData.ads || [])
      .slice(0, 5)
      .map(
        (ad: any, i: number) => `
    <div class="step-card">
      <h3>Ad ${i + 1}: ${escapeHtml(ad.pageName || "Unknown")}</h3>
      <p><strong>Status:</strong> ${ad.status} | <strong>Started:</strong> ${ad.startDate || "Unknown"}</p>
      <p><strong>Landing URL:</strong> ${escapeHtml(ad.landingUrl || "Not captured")}</p>
      ${ad.primaryText ? `<p><strong>Ad Copy:</strong> ${escapeHtml(ad.primaryText.slice(0, 300))}...</p>` : ""}
      ${
        screenshots[ad.screenshotPath]
          ? `<img src="data:image/png;base64,${screenshots[ad.screenshotPath]}" class="screenshot" alt="Ad screenshot">`
          : ""
      }
    </div>
    `
      )
      .join("")}
    `
        : ""
    }

    ${
      emailData
        ? `
    <!-- Email Sequence -->
    <h1 class="page-break">Email Sequence Analysis</h1>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Funnel URL</td><td>${escapeHtml(emailData.funnelUrl || "")}</td></tr>
      <tr><td>Total Emails</td><td>${emailData.totalEmails || 0}</td></tr>
      <tr><td>Capture Period</td><td>${emailData.captureStarted ? new Date(emailData.captureStarted).toLocaleDateString() : "N/A"} - ${emailData.captureEnded ? new Date(emailData.captureEnded).toLocaleDateString() : "Ongoing"}</td></tr>
    </table>

    <h2>Email Subjects</h2>
    <ol>
    ${(emailData.emails || [])
      .map(
        (email: any) => `
      <li><strong>"${escapeHtml(email.subject)}"</strong> - Day ${email.dayInSequence}</li>
    `
      )
      .join("")}
    </ol>
    `
        : ""
    }

    <!-- Footer -->
    <div class="footer">
      Generated by Funnel Hacker • ${new Date().toISOString()}
      <br>
      AI Analysis Team: Marcus (Ads) • Diana (Funnels) • Nadia (Email) • Victor (VSL) • Clara (Copy) • Jack (Strategy)
    </div>
  </div>
</body>
</html>`;
}
