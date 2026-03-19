import { readFile } from "fs/promises";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

// Ensure API key is available
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("\n❌ ANTHROPIC_API_KEY not found!\n");
    console.error("To fix this, either:");
    console.error("  1. Create a .env file with: ANTHROPIC_API_KEY=sk-ant-...");
    console.error("  2. Or export it: export ANTHROPIC_API_KEY=sk-ant-...");
    console.error("\nGet your API key at: https://console.anthropic.com/\n");
    process.exit(1);
  }
  return new Anthropic({ apiKey });
}

const SPECIALISTS_DIR = join(import.meta.dir, "../../specialists");

export type SpecialistType =
  | "facebook-ad"
  | "funnel-architect"
  | "email"
  | "vsl-presentation"
  | "copy"
  | "head-funnel-hacker";

interface SpecialistConfig {
  file: string;
  name: string;
  description: string;
}

const SPECIALIST_MAP: Record<SpecialistType, SpecialistConfig> = {
  "facebook-ad": {
    file: "facebook-ad-specialist.md",
    name: "Marcus",
    description: "Facebook Ad Specialist",
  },
  "funnel-architect": {
    file: "funnel-architect.md",
    name: "Diana",
    description: "Funnel Architect",
  },
  email: {
    file: "email-specialist.md",
    name: "Nadia",
    description: "Email Sequence Specialist",
  },
  "vsl-presentation": {
    file: "vsl-presentation-specialist.md",
    name: "Victor",
    description: "VSL & Presentation Specialist",
  },
  copy: {
    file: "copy-specialist.md",
    name: "Clara",
    description: "Direct Response Copy Specialist",
  },
  "head-funnel-hacker": {
    file: "head-funnel-hacker.md",
    name: "Jack",
    description: "Head Funnel Hacker",
  },
};

export async function loadSpecialistPrompt(
  type: SpecialistType
): Promise<string> {
  const config = SPECIALIST_MAP[type];
  const filePath = join(SPECIALISTS_DIR, config.file);
  return await readFile(filePath, "utf-8");
}

export function getSpecialistInfo(type: SpecialistType): SpecialistConfig {
  return SPECIALIST_MAP[type];
}

export function getAllSpecialists(): Array<{
  type: SpecialistType;
  config: SpecialistConfig;
}> {
  return Object.entries(SPECIALIST_MAP).map(([type, config]) => ({
    type: type as SpecialistType,
    config,
  }));
}

export interface AnalysisRequest {
  specialist: SpecialistType;
  content: string; // Text content to analyze
  images?: Array<{
    type: "base64";
    media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    data: string;
  }>;
  context?: string; // Additional context for the analysis
}

export interface AnalysisResult {
  specialist: SpecialistType;
  specialistName: string;
  analysis: string;
  timestamp: string;
}

export async function analyzeWithSpecialist(
  client: Anthropic,
  request: AnalysisRequest
): Promise<AnalysisResult> {
  const systemPrompt = await loadSpecialistPrompt(request.specialist);
  const specialistInfo = getSpecialistInfo(request.specialist);

  // Build the content array for the message
  const userContent: Anthropic.MessageParam["content"] = [];

  // Add images first if present
  if (request.images && request.images.length > 0) {
    for (const image of request.images) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.media_type,
          data: image.data,
        },
      });
    }
  }

  // Add the text content
  let textContent = request.content;
  if (request.context) {
    textContent = `Context: ${request.context}\n\n${textContent}`;
  }
  userContent.push({
    type: "text",
    text: textContent,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  const analysisText =
    response.content[0].type === "text" ? response.content[0].text : "";

  return {
    specialist: request.specialist,
    specialistName: specialistInfo.name,
    analysis: analysisText,
    timestamp: new Date().toISOString(),
  };
}

export async function runFullAnalysis(
  client: Anthropic,
  funnelData: {
    steps: Array<{
      url: string;
      title: string;
      screenshot: string;
      screenshotBase64?: string;
    }>;
    emails?: Array<{ subject: string; body: string }>;
    ads?: Array<{ creative: string; copy: string }>;
  },
  options: {
    outputDir: string;
    includeSpecialists?: SpecialistType[];
  }
): Promise<{
  specialists: AnalysisResult[];
  synthesis: AnalysisResult;
}> {
  const specialistsToRun: SpecialistType[] = options.includeSpecialists || [
    "funnel-architect",
    "copy",
  ];

  // Add specialists based on content
  if (funnelData.ads && funnelData.ads.length > 0) {
    if (!specialistsToRun.includes("facebook-ad")) {
      specialistsToRun.push("facebook-ad");
    }
  }

  if (funnelData.emails && funnelData.emails.length > 0) {
    if (!specialistsToRun.includes("email")) {
      specialistsToRun.push("email");
    }
  }

  // Check for video content in page titles/URLs
  const hasVideoContent = funnelData.steps.some(
    (step) =>
      step.url.includes("video") ||
      step.url.includes("webinar") ||
      step.url.includes("watch") ||
      step.title.toLowerCase().includes("video") ||
      step.title.toLowerCase().includes("webinar")
  );

  if (hasVideoContent && !specialistsToRun.includes("vsl-presentation")) {
    specialistsToRun.push("vsl-presentation");
  }

  console.log(
    `\n🧠 Running analysis with specialists: ${specialistsToRun.join(", ")}\n`
  );

  // Run specialist analyses
  const specialistResults: AnalysisResult[] = [];

  for (const specialist of specialistsToRun) {
    const info = getSpecialistInfo(specialist);
    console.log(`📊 ${info.name} (${info.description}) analyzing...`);

    // Build content based on specialist type
    let content = "";
    const images: AnalysisRequest["images"] = [];

    if (specialist === "funnel-architect") {
      content = `Analyze this funnel with ${funnelData.steps.length} steps:\n\n`;
      for (const step of funnelData.steps) {
        content += `Step ${funnelData.steps.indexOf(step) + 1}: ${step.title}\nURL: ${step.url}\n\n`;
        if (step.screenshotBase64) {
          images.push({
            type: "base64",
            media_type: "image/png",
            data: step.screenshotBase64,
          });
        }
      }
    } else if (specialist === "copy") {
      content = `Analyze the copy from these funnel pages:\n\n`;
      for (const step of funnelData.steps) {
        content += `Page: ${step.title}\nURL: ${step.url}\n\n`;
        if (step.screenshotBase64) {
          images.push({
            type: "base64",
            media_type: "image/png",
            data: step.screenshotBase64,
          });
        }
      }
    } else if (specialist === "email" && funnelData.emails) {
      content = `Analyze this email sequence:\n\n`;
      for (const email of funnelData.emails) {
        content += `Subject: ${email.subject}\n${email.body}\n\n---\n\n`;
      }
    } else if (specialist === "facebook-ad" && funnelData.ads) {
      content = `Analyze these ads:\n\n`;
      for (const ad of funnelData.ads) {
        content += `Creative: ${ad.creative}\nCopy: ${ad.copy}\n\n---\n\n`;
      }
    } else if (specialist === "vsl-presentation") {
      content = `Analyze the video/presentation content from these pages:\n\n`;
      for (const step of funnelData.steps) {
        content += `Page: ${step.title}\nURL: ${step.url}\n\n`;
        if (step.screenshotBase64) {
          images.push({
            type: "base64",
            media_type: "image/png",
            data: step.screenshotBase64,
          });
        }
      }
    }

    try {
      const result = await analyzeWithSpecialist(client, {
        specialist,
        content,
        images: images.length > 0 ? images : undefined,
      });
      specialistResults.push(result);
      console.log(`   ✅ ${info.name} complete`);
    } catch (error) {
      console.error(`   ❌ ${info.name} failed:`, error);
    }
  }

  // Run synthesis with Head Funnel Hacker
  console.log(`\n🎯 Jack (Head Funnel Hacker) synthesizing all analyses...`);

  const synthesisContent = `
You have received analyses from your specialist team. Synthesize these into a comprehensive funnel analysis report.

## Funnel Overview
- Total Steps: ${funnelData.steps.length}
- URLs Analyzed: ${funnelData.steps.map((s) => s.url).join(", ")}

## Specialist Reports

${specialistResults
  .map(
    (r) => `
### ${r.specialistName}'s Analysis
${r.analysis}
`
  )
  .join("\n---\n")}

Please provide your executive synthesis following the format in your guidelines.
`;

  const synthesis = await analyzeWithSpecialist(client, {
    specialist: "head-funnel-hacker",
    content: synthesisContent,
    context: `Analyzing funnel starting at: ${funnelData.steps[0]?.url}`,
  });

  console.log(`   ✅ Synthesis complete\n`);

  return {
    specialists: specialistResults,
    synthesis,
  };
}
