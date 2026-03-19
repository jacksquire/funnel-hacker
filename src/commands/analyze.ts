import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import {
  runFullAnalysis,
  type SpecialistType,
  getAllSpecialists,
} from "../lib/specialists";

interface AnalyzeOptions {
  specialists?: string;
  output?: string;
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
    timestamp: string;
    ctaText?: string;
    forms?: string[];
  }>;
}

export async function analyzeFunnel(funnelDir: string, options: AnalyzeOptions) {
  console.log(`\n🔍 Analyzing funnel from: ${funnelDir}\n`);

  // Load funnel data
  const funnelJsonPath = join(funnelDir, "funnel.json");
  let funnelData: FunnelData;

  try {
    const content = await readFile(funnelJsonPath, "utf-8");
    funnelData = JSON.parse(content);
  } catch (error) {
    console.error(`❌ Could not load funnel.json from ${funnelDir}`);
    console.error("   Run 'funnel-hacker walk <url>' first to capture a funnel.");
    process.exit(1);
  }

  console.log(`📊 Found ${funnelData.steps.length} steps to analyze`);

  // Load screenshots as base64
  const stepsWithImages = await Promise.all(
    funnelData.steps.map(async (step) => {
      const screenshotPath = join(funnelDir, step.screenshot);
      try {
        const imageBuffer = await readFile(screenshotPath);
        const base64 = imageBuffer.toString("base64");
        return {
          ...step,
          screenshotBase64: base64,
        };
      } catch {
        console.warn(`   ⚠️ Could not load screenshot: ${step.screenshot}`);
        return step;
      }
    })
  );

  // Initialize Anthropic client
  const client = new Anthropic();

  // Determine which specialists to run
  let specialists: SpecialistType[] | undefined;
  if (options.specialists) {
    specialists = options.specialists.split(",").map((s) => s.trim()) as SpecialistType[];
    console.log(`🧠 Using specialists: ${specialists.join(", ")}`);
  }

  // Run analysis
  const results = await runFullAnalysis(
    client,
    {
      steps: stepsWithImages,
    },
    {
      outputDir: funnelDir,
      includeSpecialists: specialists,
    }
  );

  // Save results
  const analysisOutputPath = join(funnelDir, "analysis.json");
  await writeFile(
    analysisOutputPath,
    JSON.stringify(
      {
        analyzedAt: new Date().toISOString(),
        funnelSource: funnelData.startUrl,
        specialists: results.specialists.map((s) => ({
          type: s.specialist,
          name: s.specialistName,
          timestamp: s.timestamp,
        })),
        fullAnalysis: results.synthesis.analysis,
        specialistReports: results.specialists.reduce(
          (acc, s) => {
            acc[s.specialist] = s.analysis;
            return acc;
          },
          {} as Record<string, string>
        ),
      },
      null,
      2
    )
  );

  // Save markdown report
  const reportPath = join(funnelDir, "analysis-report.md");
  const markdownReport = generateMarkdownReport(funnelData, results);
  await writeFile(reportPath, markdownReport);

  console.log(`\n✨ Analysis complete!`);
  console.log(`   📄 Full report: ${reportPath}`);
  console.log(`   📊 JSON data: ${analysisOutputPath}`);

  // Print executive summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("EXECUTIVE SUMMARY");
  console.log("=".repeat(60));

  // Extract just the executive summary from the synthesis
  const summaryMatch = results.synthesis.analysis.match(
    /## Executive Summary([\s\S]*?)(?=##|$)/
  );
  if (summaryMatch) {
    console.log(summaryMatch[1].trim());
  } else {
    // Print first 500 chars if no executive summary found
    console.log(results.synthesis.analysis.slice(0, 500) + "...");
  }

  console.log(`\n${"=".repeat(60)}\n`);
}

function generateMarkdownReport(
  funnelData: FunnelData,
  results: {
    specialists: Array<{
      specialist: string;
      specialistName: string;
      analysis: string;
      timestamp: string;
    }>;
    synthesis: {
      analysis: string;
      timestamp: string;
    };
  }
): string {
  return `# Funnel Analysis Report

**Source:** ${funnelData.startUrl}
**Analyzed:** ${new Date().toISOString()}
**Steps Captured:** ${funnelData.steps.length}

---

${results.synthesis.analysis}

---

# Specialist Reports

${results.specialists
  .map(
    (s) => `
## ${s.specialistName}'s Analysis

*Completed: ${s.timestamp}*

${s.analysis}

---
`
  )
  .join("\n")}

# Funnel Steps Reference

${funnelData.steps
  .map(
    (step) => `
## Step ${step.step}: ${step.title}

- **URL:** ${step.url}
- **Screenshot:** ${step.screenshot}
- **CTA Found:** ${step.ctaText || "None detected"}
- **Forms:** ${step.forms?.join(", ") || "None detected"}
`
  )
  .join("\n")}
`;
}

export async function listSpecialists() {
  console.log("\n🧠 Available Specialists:\n");

  const specialists = getAllSpecialists();
  for (const { type, config } of specialists) {
    console.log(`  ${config.name.padEnd(10)} (${type})`);
    console.log(`  └─ ${config.description}\n`);
  }

  console.log("Usage: funnel-hacker analyze <dir> --specialists=copy,funnel-architect\n");
}
