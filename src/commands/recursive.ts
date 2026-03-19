import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { walkFunnel } from "./walk";
import { discoverAds } from "./ads";
import { analyzeFunnel } from "./analyze";

interface RecursiveOptions {
  output: string;
  maxDepth: number;
  maxCompetitors: number;
  includeAnalysis: boolean;
  headless: boolean;
}

interface CompetitorNode {
  id: string;
  url: string;
  domain: string;
  name?: string;
  discoveredFrom?: string;
  depth: number;
  funnelDir?: string;
  adsFound: number;
  landingUrls: string[];
  status: "pending" | "processing" | "complete" | "failed";
}

interface CompetitorGraph {
  startUrl: string;
  startedAt: string;
  completedAt?: string;
  maxDepth: number;
  nodes: CompetitorNode[];
  edges: Array<{ from: string; to: string; type: "ad" | "mention" | "link" }>;
  stats: {
    totalCompetitors: number;
    totalFunnels: number;
    totalAds: number;
    totalPages: number;
  };
}

export async function recursiveHack(startUrl: string, options: RecursiveOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = join(options.output, `landscape-${timestamp}`);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🕸️  RECURSIVE FUNNEL DISCOVERY                   ║
║           Map the entire competitive landscape                ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`🎯 Starting URL: ${startUrl}`);
  console.log(`📊 Max depth: ${options.maxDepth}`);
  console.log(`👥 Max competitors: ${options.maxCompetitors}`);
  console.log(`📁 Output: ${outputDir}\n`);

  await mkdir(outputDir, { recursive: true });

  const graph: CompetitorGraph = {
    startUrl,
    startedAt: new Date().toISOString(),
    maxDepth: options.maxDepth,
    nodes: [],
    edges: [],
    stats: {
      totalCompetitors: 0,
      totalFunnels: 0,
      totalAds: 0,
      totalPages: 0,
    },
  };

  // Queue of URLs to process
  const queue: CompetitorNode[] = [];
  const processedDomains = new Set<string>();

  // Add starting URL
  const startDomain = new URL(startUrl).hostname.replace("www.", "");
  const startNode: CompetitorNode = {
    id: `comp-0`,
    url: startUrl,
    domain: startDomain,
    depth: 0,
    adsFound: 0,
    landingUrls: [],
    status: "pending",
  };
  queue.push(startNode);
  graph.nodes.push(startNode);

  let competitorCount = 0;

  while (queue.length > 0 && competitorCount < options.maxCompetitors) {
    const node = queue.shift()!;

    // Skip if already processed this domain
    if (processedDomains.has(node.domain)) {
      node.status = "complete";
      continue;
    }

    // Skip if beyond max depth
    if (node.depth > options.maxDepth) {
      continue;
    }

    processedDomains.add(node.domain);
    node.status = "processing";
    competitorCount++;

    console.log(`\n${"═".repeat(60)}`);
    console.log(`COMPETITOR ${competitorCount}: ${node.domain} (depth: ${node.depth})`);
    console.log("═".repeat(60));

    const competitorDir = join(outputDir, `${competitorCount}-${node.domain}`);
    await mkdir(competitorDir, { recursive: true });

    try {
      // Step 1: Walk the funnel
      console.log(`\n📸 Walking funnel: ${node.url}`);
      const funnelResult = await walkFunnel(node.url, {
        output: competitorDir,
        depth: "8",
        headless: options.headless,
      });

      node.funnelDir = competitorDir;
      graph.stats.totalPages += funnelResult.steps.length;
      graph.stats.totalFunnels++;

      // Move funnel files to competitor dir root
      const { readdir, rename } = await import("fs/promises");
      const dirs = await readdir(competitorDir);
      const funnelSubdir = dirs.find((d) => d.match(/^\d{4}-\d{2}-\d{2}/));
      if (funnelSubdir) {
        const files = await readdir(join(competitorDir, funnelSubdir));
        for (const file of files) {
          await rename(
            join(competitorDir, funnelSubdir, file),
            join(competitorDir, file)
          ).catch(() => {});
        }
      }

      // Step 2: Discover ads (if not at max depth)
      if (node.depth < options.maxDepth) {
        console.log(`\n📢 Discovering ads for: ${node.domain}`);
        try {
          const adsResult = await discoverAds(node.domain, {
            output: competitorDir,
            limit: "15",
            country: "US",
            headless: options.headless,
          });

          node.adsFound = adsResult.totalFound;
          graph.stats.totalAds += adsResult.totalFound;

          // Move ads files
          const adsDirs = (await readdir(competitorDir)).filter((d) =>
            d.startsWith("ads-")
          );
          if (adsDirs.length > 0) {
            const adsSubdir = join(competitorDir, adsDirs[0]);
            const adsFiles = await readdir(adsSubdir);
            for (const file of adsFiles) {
              await rename(
                join(adsSubdir, file),
                join(competitorDir, file)
              ).catch(() => {});
            }
          }

          // Extract landing URLs and queue new competitors
          const newLandingUrls = adsResult.ads
            .filter((ad) => ad.landingUrl)
            .map((ad) => ad.landingUrl!)
            .filter((url) => {
              try {
                const domain = new URL(url).hostname.replace("www.", "");
                return !processedDomains.has(domain);
              } catch {
                return false;
              }
            });

          node.landingUrls = [...new Set(newLandingUrls)];

          // Queue new competitors from ad landing pages
          for (const landingUrl of node.landingUrls.slice(0, 5)) {
            // Limit per source
            try {
              const domain = new URL(landingUrl).hostname.replace("www.", "");
              if (!processedDomains.has(domain)) {
                const newNode: CompetitorNode = {
                  id: `comp-${graph.nodes.length}`,
                  url: landingUrl,
                  domain,
                  discoveredFrom: node.id,
                  depth: node.depth + 1,
                  adsFound: 0,
                  landingUrls: [],
                  status: "pending",
                };
                queue.push(newNode);
                graph.nodes.push(newNode);
                graph.edges.push({
                  from: node.id,
                  to: newNode.id,
                  type: "ad",
                });
                console.log(`   📍 Queued: ${domain} (from ad)`);
              }
            } catch {
              // Invalid URL
            }
          }
        } catch (error) {
          console.warn(`   ⚠️ Ad discovery failed: ${error}`);
        }
      }

      // Step 3: Analyze (optional)
      if (options.includeAnalysis) {
        console.log(`\n🧠 Analyzing funnel...`);
        try {
          await analyzeFunnel(competitorDir, {});
        } catch (error) {
          console.warn(`   ⚠️ Analysis failed: ${error}`);
        }
      }

      node.status = "complete";
    } catch (error) {
      console.error(`\n❌ Failed to process ${node.domain}:`, error);
      node.status = "failed";
    }

    // Save progress after each competitor
    await writeFile(
      join(outputDir, "landscape.json"),
      JSON.stringify(graph, null, 2)
    );
  }

  // Finalize
  graph.completedAt = new Date().toISOString();
  graph.stats.totalCompetitors = processedDomains.size;

  // Save final graph
  await writeFile(
    join(outputDir, "landscape.json"),
    JSON.stringify(graph, null, 2)
  );

  // Generate summary report
  await writeFile(
    join(outputDir, "LANDSCAPE-REPORT.md"),
    generateLandscapeReport(graph)
  );

  // Generate mermaid diagram
  await writeFile(
    join(outputDir, "competitor-graph.mmd"),
    generateMermaidDiagram(graph)
  );

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              ✨ LANDSCAPE MAPPING COMPLETE                    ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`📊 Results:`);
  console.log(`   👥 Competitors mapped: ${graph.stats.totalCompetitors}`);
  console.log(`   🎯 Funnels captured: ${graph.stats.totalFunnels}`);
  console.log(`   📢 Ads discovered: ${graph.stats.totalAds}`);
  console.log(`   📸 Pages captured: ${graph.stats.totalPages}`);
  console.log(`\n📁 Output: ${outputDir}`);
  console.log(`   📄 landscape.json - Full data`);
  console.log(`   📄 LANDSCAPE-REPORT.md - Summary report`);
  console.log(`   📄 competitor-graph.mmd - Mermaid diagram`);

  return graph;
}

function generateLandscapeReport(graph: CompetitorGraph): string {
  const completed = graph.nodes.filter((n) => n.status === "complete");
  const failed = graph.nodes.filter((n) => n.status === "failed");

  return `# Competitive Landscape Report

**Starting Point:** ${graph.startUrl}
**Mapped:** ${graph.startedAt} - ${graph.completedAt || "ongoing"}
**Max Depth:** ${graph.maxDepth}

## Summary

| Metric | Value |
|--------|-------|
| Competitors Mapped | ${graph.stats.totalCompetitors} |
| Funnels Captured | ${graph.stats.totalFunnels} |
| Ads Discovered | ${graph.stats.totalAds} |
| Total Pages | ${graph.stats.totalPages} |

## Competitors by Depth

${Array.from({ length: graph.maxDepth + 1 }, (_, depth) => {
  const atDepth = graph.nodes.filter((n) => n.depth === depth);
  if (atDepth.length === 0) return "";
  return `### Depth ${depth}${depth === 0 ? " (Starting Point)" : ""}

${atDepth
  .map(
    (n) => `- **${n.domain}**
  - Status: ${n.status}
  - Ads found: ${n.adsFound}
  - Landing URLs discovered: ${n.landingUrls.length}
  ${n.discoveredFrom ? `- Discovered from: ${graph.nodes.find((x) => x.id === n.discoveredFrom)?.domain || "unknown"}` : ""}`
  )
  .join("\n\n")}
`;
}).join("\n")}

## Discovery Graph

\`\`\`mermaid
${generateMermaidDiagram(graph)}
\`\`\`

## Competitor Details

${completed
  .map(
    (n, i) => `### ${i + 1}. ${n.domain}

- **URL:** ${n.url}
- **Depth:** ${n.depth}
- **Ads Found:** ${n.adsFound}
- **Directory:** ${n.funnelDir || "N/A"}

${
  n.landingUrls.length > 0
    ? `**Landing URLs from their ads:**
${n.landingUrls.map((url) => `- ${url}`).join("\n")}`
    : ""
}
`
  )
  .join("\n---\n\n")}

${
  failed.length > 0
    ? `## Failed to Process

${failed.map((n) => `- ${n.domain}: ${n.status}`).join("\n")}`
    : ""
}

## Next Steps

1. Review each competitor's funnel in their directory
2. Run \`funnel-hacker analyze <dir>\` on interesting funnels
3. Compare approaches across competitors
4. Identify gaps and opportunities
`;
}

function generateMermaidDiagram(graph: CompetitorGraph): string {
  const lines = ["graph TD"];

  // Add nodes
  for (const node of graph.nodes) {
    const label = `${node.domain}\\n(${node.adsFound} ads)`;
    const style =
      node.depth === 0
        ? ":::start"
        : node.status === "failed"
          ? ":::failed"
          : "";
    lines.push(`    ${node.id}["${label}"]${style}`);
  }

  // Add edges
  for (const edge of graph.edges) {
    const style = edge.type === "ad" ? "-->|ad|" : "-->";
    lines.push(`    ${edge.from} ${style} ${edge.to}`);
  }

  // Add styles
  lines.push("    classDef start fill:#4ade80,stroke:#166534");
  lines.push("    classDef failed fill:#f87171,stroke:#991b1b");

  return lines.join("\n");
}
