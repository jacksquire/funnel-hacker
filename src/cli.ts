#!/usr/bin/env bun
import { Command } from "commander";
import { walkFunnel } from "./commands/walk";
// import { discoverAds } from "./commands/ads";
// import { generateReport } from "./commands/report";

const program = new Command();

program
  .name("funnel-hacker")
  .description("Reverse-engineer competitor funnels")
  .version("0.1.0");

program
  .command("walk <url>")
  .description("Walk through a funnel, capturing each step")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("-d, --depth <number>", "Max pages to capture", "10")
  .option("--headless", "Run in headless mode", true)
  .option("--no-headless", "Run with visible browser")
  .action(async (url, options) => {
    await walkFunnel(url, options);
  });

// program
//   .command("ads <page>")
//   .description("Discover ads from Facebook Ad Library")
//   .option("-o, --output <dir>", "Output directory", "./output")
//   .action(async (page, options) => {
//     await discoverAds(page, options);
//   });

// program
//   .command("report <dir>")
//   .description("Generate PDF report from funnel data")
//   .option("-t, --template <name>", "Report template", "default")
//   .action(async (dir, options) => {
//     await generateReport(dir, options);
//   });

program.parse();
