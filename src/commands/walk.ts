import { chromium, type Page, type Browser } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

interface WalkOptions {
  output: string;
  depth: string;
  headless: boolean;
}

interface FunnelStep {
  step: number;
  url: string;
  title: string;
  screenshot: string;
  timestamp: string;
  ctaText?: string;
  forms?: string[];
}

interface FunnelData {
  startUrl: string;
  startedAt: string;
  completedAt?: string;
  steps: FunnelStep[];
}

export async function walkFunnel(startUrl: string, options: WalkOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = join(options.output, timestamp);
  const maxDepth = parseInt(options.depth, 10);

  console.log(`\n🚀 Starting funnel walk: ${startUrl}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log(`📊 Max steps: ${maxDepth}\n`);

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: options.headless,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  const page = await context.newPage();
  const funnelData: FunnelData = {
    startUrl,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  try {
    let currentUrl = startUrl;
    let stepCount = 0;

    while (stepCount < maxDepth) {
      stepCount++;
      console.log(`\n📸 Step ${stepCount}: ${currentUrl}`);

      await page.goto(currentUrl, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000); // Let animations settle

      const title = await page.title();
      const screenshotPath = join(outputDir, `step-${stepCount}.png`);

      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      // Extract page data
      const pageData = await extractPageData(page);

      const step: FunnelStep = {
        step: stepCount,
        url: page.url(),
        title,
        screenshot: `step-${stepCount}.png`,
        timestamp: new Date().toISOString(),
        ctaText: pageData.ctaText,
        forms: pageData.forms,
      };

      funnelData.steps.push(step);
      console.log(`   ✅ Captured: ${title}`);

      // Find and click the primary CTA
      const nextUrl = await findAndClickCTA(page);
      if (!nextUrl || nextUrl === currentUrl) {
        console.log("\n🏁 End of funnel reached (no new CTA found)");
        break;
      }

      currentUrl = nextUrl;
    }

    funnelData.completedAt = new Date().toISOString();

    // Save funnel data
    const jsonPath = join(outputDir, "funnel.json");
    await writeFile(jsonPath, JSON.stringify(funnelData, null, 2));

    console.log(`\n✨ Funnel walk complete!`);
    console.log(`   📊 ${funnelData.steps.length} steps captured`);
    console.log(`   📁 Output: ${outputDir}`);
    console.log(`   📄 Data: ${jsonPath}\n`);
  } catch (error) {
    console.error("\n❌ Error during funnel walk:", error);
    throw error;
  } finally {
    await browser.close();
  }

  return funnelData;
}

async function extractPageData(page: Page) {
  return await page.evaluate(() => {
    // Find CTAs
    const ctaSelectors = [
      'button[type="submit"]',
      'a[href*="checkout"]',
      'a[href*="buy"]',
      'a[href*="order"]',
      'a[href*="register"]',
      'a[href*="signup"]',
      'a[href*="sign-up"]',
      ".cta",
      "[data-cta]",
      'button:not([type="button"])',
    ];

    let ctaText: string | undefined;
    for (const selector of ctaSelectors) {
      const el = document.querySelector(selector);
      if (el?.textContent?.trim()) {
        ctaText = el.textContent.trim();
        break;
      }
    }

    // Find forms
    const forms = Array.from(document.querySelectorAll("form")).map((form) => {
      const inputs = Array.from(form.querySelectorAll("input"))
        .map((i) => i.name || i.type)
        .filter(Boolean);
      return inputs.join(", ");
    });

    return { ctaText, forms: forms.filter(Boolean) };
  });
}

async function findAndClickCTA(page: Page): Promise<string | null> {
  const ctaSelectors = [
    // Primary CTAs
    'a[href*="checkout"]',
    'a[href*="buy"]',
    'a[href*="order"]',
    'a[href*="register"]',
    'a[href*="signup"]',
    'a[href*="sign-up"]',
    'a[href*="get-started"]',
    'a[href*="start"]',
    // Button-like links
    'a.btn-primary',
    'a.cta',
    'a[class*="button"]',
    // Forms
    'form button[type="submit"]',
    'form input[type="submit"]',
  ];

  for (const selector of ctaSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) {
          // For links, get the href and navigate
          const href = await element.getAttribute("href");
          if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
            const fullUrl = new URL(href, page.url()).toString();
            return fullUrl;
          }

          // For buttons/forms, click and wait for navigation
          await Promise.all([
            page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
            element.click(),
          ]);

          return page.url();
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}
