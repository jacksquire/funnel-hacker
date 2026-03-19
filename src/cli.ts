#!/usr/bin/env bun
import { Command } from "commander";
import { walkFunnel } from "./commands/walk";
import { analyzeFunnel, listSpecialists } from "./commands/analyze";
import { discoverAds, listAds } from "./commands/ads";
import { captureEmails } from "./commands/capture-emails";
import { generateReport } from "./commands/report";
import { hackFunnel } from "./commands/hack";
import { recursiveHack } from "./commands/recursive";

const program = new Command();

program
  .name("funnel-hacker")
  .description("Reverse-engineer competitor funnels with AI-powered analysis")
  .version("0.2.0");

// ============================================
// MAIN COMMAND: hack (does everything)
// ============================================
program
  .command("hack <url>")
  .description("🎯 Complete funnel hack: capture, analyze, and report")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("-d, --depth <number>", "Max funnel pages to capture", "10")
  .option("--include-ads", "Also discover Facebook ads", false)
  .option("--ads-query <query>", "Custom query for ad discovery")
  .option("--recursive", "Enable recursive competitor discovery", false)
  .option("--recursive-depth <number>", "Max recursion depth (with --recursive)", "2")
  .option("--max-competitors <number>", "Max competitors (with --recursive)", "10")
  .option("--skip-analysis", "Skip AI analysis", false)
  .option("--skip-pdf", "Skip PDF report generation", false)
  .option("--headless", "Run browsers in headless mode", true)
  .option("--no-headless", "Run with visible browsers")
  .action(async (url, options) => {
    if (options.recursive) {
      // Use recursive mode
      await recursiveHack(url, {
        output: options.output,
        maxDepth: parseInt(options.recursiveDepth, 10),
        maxCompetitors: parseInt(options.maxCompetitors, 10),
        includeAnalysis: !options.skipAnalysis,
        headless: options.headless,
      });
    } else {
      await hackFunnel(url, options);
    }
  });

// ============================================
// RECURSIVE DISCOVERY
// ============================================
program
  .command("landscape <url>")
  .description("🕸️ Recursive discovery: map entire competitive landscape")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("-d, --depth <number>", "Max recursion depth", "2")
  .option("-m, --max <number>", "Max competitors to map", "10")
  .option("--analyze", "Run AI analysis on each funnel", false)
  .option("--headless", "Run browsers in headless mode", true)
  .option("--no-headless", "Run with visible browsers")
  .action(async (url, options) => {
    await recursiveHack(url, {
      output: options.output,
      maxDepth: parseInt(options.depth, 10),
      maxCompetitors: parseInt(options.max, 10),
      includeAnalysis: options.analyze,
      headless: options.headless,
    });
  });

// ============================================
// INDIVIDUAL COMMANDS
// ============================================

// Walk funnel
program
  .command("walk <url>")
  .description("📸 Walk through a funnel, capturing screenshots of each step")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("-d, --depth <number>", "Max pages to capture", "10")
  .option("--headless", "Run in headless mode", true)
  .option("--no-headless", "Run with visible browser")
  .action(async (url, options) => {
    await walkFunnel(url, options);
  });

// Discover ads
program
  .command("ads <query>")
  .description("📢 Discover ads from Facebook Ad Library")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("-l, --limit <number>", "Max ads to capture", "20")
  .option("-c, --country <code>", "Country code", "US")
  .option("--headless", "Run in headless mode", true)
  .option("--no-headless", "Run with visible browser")
  .action(async (query, options) => {
    await discoverAds(query, options);
  });

// Capture emails
program
  .command("emails <funnel-url>")
  .description("📧 Sign up and capture email sequence from a funnel")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("--days <number>", "Days to monitor for emails", "7")
  .option("--email <address>", "Your email address to use for signup")
  .option("--temp-email", "Use a temporary email address", false)
  .option("--headless", "Run in headless mode", true)
  .option("--no-headless", "Run with visible browser")
  .action(async (url, options) => {
    await captureEmails(url, options);
  });

// Analyze captured funnel
program
  .command("analyze <dir>")
  .description("🧠 Analyze a captured funnel with AI specialists")
  .option(
    "-s, --specialists <list>",
    "Comma-separated list of specialists (default: auto-detect)"
  )
  .option("-o, --output <format>", "Output format: json, markdown, both", "both")
  .action(async (dir, options) => {
    await analyzeFunnel(dir, options);
  });

// Generate PDF report
program
  .command("report <dir>")
  .description("📄 Generate PDF report from analyzed funnel")
  .option("-t, --template <name>", "Report template", "default")
  .option("-o, --output <path>", "Output PDF path")
  .option("--title <title>", "Report title")
  .action(async (dir, options) => {
    await generateReport(dir, options);
  });

// ============================================
// UTILITY COMMANDS
// ============================================

// List specialists
program
  .command("specialists")
  .description("👥 List available AI analysis specialists")
  .action(async () => {
    await listSpecialists();
  });

// List ads from a previous capture
program
  .command("list-ads <dir>")
  .description("📋 List ads from a previous capture")
  .action(async (dir) => {
    await listAds(dir);
  });

// Quick stats
program
  .command("stats <dir>")
  .description("📊 Show quick stats from a hack output directory")
  .action(async (dir) => {
    const { readFile, readdir } = await import("fs/promises");
    const { join } = await import("path");

    console.log(`\n📊 Stats for: ${dir}\n`);

    try {
      // Check what files exist
      const files = await readdir(dir);
      console.log(`Files: ${files.length}`);

      if (files.includes("funnel.json")) {
        const data = JSON.parse(await readFile(join(dir, "funnel.json"), "utf-8"));
        console.log(`Funnel steps: ${data.steps?.length || 0}`);
      }

      if (files.includes("ads.json")) {
        const data = JSON.parse(await readFile(join(dir, "ads.json"), "utf-8"));
        console.log(`Ads captured: ${data.totalFound || 0}`);
      }

      if (files.includes("email-sequence.json")) {
        const data = JSON.parse(await readFile(join(dir, "email-sequence.json"), "utf-8"));
        console.log(`Emails captured: ${data.totalEmails || 0}`);
      }

      if (files.includes("analysis.json")) {
        console.log(`Analysis: ✅ Complete`);
      }

      if (files.includes("funnel-report.pdf")) {
        console.log(`PDF Report: ✅ Generated`);
      }

    } catch (error) {
      console.error("Error reading stats:", error);
    }
  });

program.parse();
