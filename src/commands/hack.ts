import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { walkFunnel } from "./walk";
import { discoverAds } from "./ads";
import { analyzeFunnel } from "./analyze";
import { generateReport } from "./report";

interface HackOptions {
  output: string;
  depth: string;
  includeAds: boolean;
  adsQuery?: string;
  skipAnalysis: boolean;
  skipPdf: boolean;
  headless: boolean;
}

export async function hackFunnel(startUrl: string, options: HackOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = join(options.output, `hack-${timestamp}`);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    🎯 FUNNEL HACKER                           ║
║              Complete Funnel Intelligence Suite               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`🎯 Target: ${startUrl}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log(`\n📋 Pipeline:`);
  console.log(`   1. Walk funnel and capture screenshots`);
  if (options.includeAds) {
    console.log(`   2. Discover Facebook ads`);
  }
  if (!options.skipAnalysis) {
    console.log(`   ${options.includeAds ? "3" : "2"}. AI analysis with specialist team`);
  }
  if (!options.skipPdf) {
    console.log(`   ${options.includeAds && !options.skipAnalysis ? "4" : !options.skipAnalysis ? "3" : "2"}. Generate PDF report`);
  }
  console.log();

  await mkdir(outputDir, { recursive: true });

  const results: any = {
    target: startUrl,
    startedAt: new Date().toISOString(),
    outputDir,
    steps: {},
  };

  try {
    // Step 1: Walk the funnel
    console.log(`\n${"═".repeat(60)}`);
    console.log("STEP 1: FUNNEL CAPTURE");
    console.log("═".repeat(60));

    const funnelResult = await walkFunnel(startUrl, {
      output: outputDir,
      depth: options.depth,
      headless: options.headless,
    });

    results.steps.walk = {
      success: true,
      pagesCaptures: funnelResult.steps.length,
    };

    // Find the actual output directory (walkFunnel creates a timestamped subfolder)
    const { readdir } = await import("fs/promises");
    const dirs = await readdir(outputDir);
    const walkDir = dirs.find((d) => d.match(/^\d{4}-\d{2}-\d{2}/));
    const actualOutputDir = walkDir ? join(outputDir, walkDir) : outputDir;

    // Move files to main output dir if in subfolder
    if (walkDir) {
      const { rename, readdir: rd } = await import("fs/promises");
      const files = await rd(actualOutputDir);
      for (const file of files) {
        await rename(join(actualOutputDir, file), join(outputDir, file)).catch(() => {});
      }
    }

    // Step 2: Discover ads (optional)
    if (options.includeAds) {
      console.log(`\n${"═".repeat(60)}`);
      console.log("STEP 2: AD DISCOVERY");
      console.log("═".repeat(60));

      // Extract domain for ad search
      const domain = new URL(startUrl).hostname.replace("www.", "");
      const adsQuery = options.adsQuery || domain;

      try {
        const adsResult = await discoverAds(adsQuery, {
          output: outputDir,
          limit: "10",
          country: "US",
          headless: options.headless,
        });

        // Move ads to main output dir
        const adsDirs = (await readdir(outputDir)).filter((d) => d.startsWith("ads-"));
        if (adsDirs.length > 0) {
          const adsDir = join(outputDir, adsDirs[0]);
          const adsFiles = await readdir(adsDir);
          for (const file of adsFiles) {
            const { rename } = await import("fs/promises");
            await rename(join(adsDir, file), join(outputDir, file)).catch(() => {});
          }
        }

        results.steps.ads = {
          success: true,
          adsFound: adsResult.totalFound,
        };
      } catch (error) {
        console.warn("   ⚠️ Ad discovery failed:", error);
        results.steps.ads = { success: false, error: String(error) };
      }
    }

    // Step 3: AI Analysis
    if (!options.skipAnalysis) {
      console.log(`\n${"═".repeat(60)}`);
      console.log(`STEP ${options.includeAds ? "3" : "2"}: AI ANALYSIS`);
      console.log("═".repeat(60));

      try {
        await analyzeFunnel(outputDir, {});
        results.steps.analysis = { success: true };
      } catch (error) {
        console.warn("   ⚠️ Analysis failed:", error);
        results.steps.analysis = { success: false, error: String(error) };
      }
    }

    // Step 4: Generate PDF
    if (!options.skipPdf) {
      console.log(`\n${"═".repeat(60)}`);
      console.log(`STEP ${options.includeAds && !options.skipAnalysis ? "4" : !options.skipAnalysis ? "3" : "2"}: PDF REPORT`);
      console.log("═".repeat(60));

      try {
        const pdfPath = await generateReport(outputDir, {
          template: "default",
          title: `Funnel Analysis: ${new URL(startUrl).hostname}`,
        });
        results.steps.report = { success: true, path: pdfPath };
      } catch (error) {
        console.warn("   ⚠️ PDF generation failed:", error);
        results.steps.report = { success: false, error: String(error) };
      }
    }

    // Save results summary
    results.completedAt = new Date().toISOString();
    await writeFile(join(outputDir, "hack-results.json"), JSON.stringify(results, null, 2));

    // Final summary
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    ✨ HACK COMPLETE                           ║
╚═══════════════════════════════════════════════════════════════╝
`);

    console.log(`📊 Results Summary:`);
    console.log(`   📸 Funnel pages captured: ${results.steps.walk?.pagesCaptures || 0}`);
    if (results.steps.ads) {
      console.log(`   📢 Ads discovered: ${results.steps.ads.adsFound || 0}`);
    }
    console.log(`   🧠 AI analysis: ${results.steps.analysis?.success ? "✅" : "❌"}`);
    console.log(`   📄 PDF report: ${results.steps.report?.success ? "✅" : "❌"}`);

    console.log(`\n📁 Output directory: ${outputDir}`);
    console.log(`\n📂 Files generated:`);
    const files = await readdir(outputDir);
    for (const file of files) {
      console.log(`   • ${file}`);
    }

    // Top recommendations teaser
    if (results.steps.analysis?.success) {
      console.log(`\n💡 Open the analysis report to see:`);
      console.log(`   • Executive summary and grades`);
      console.log(`   • Steal-worthy tactics to model`);
      console.log(`   • Weaknesses to exploit`);
      console.log(`   • Quick wins to implement today`);
    }

  } catch (error) {
    console.error("\n❌ Hack failed:", error);
    results.error = String(error);
    await writeFile(join(outputDir, "hack-results.json"), JSON.stringify(results, null, 2));
    throw error;
  }

  return results;
}
