import { chromium, type Page, type Browser } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

interface AdsOptions {
  output: string;
  limit: string;
  country: string;
  headless: boolean;
}

interface AdData {
  id: string;
  pageId: string;
  pageName: string;
  status: "active" | "inactive";
  startDate?: string;
  platforms: string[];
  primaryText?: string;
  headline?: string;
  description?: string;
  ctaButton?: string;
  landingUrl?: string;
  mediaType: "image" | "video" | "carousel" | "unknown";
  screenshotPath?: string;
  impressionsRange?: string;
  spendRange?: string;
}

interface AdsResult {
  query: string;
  scrapedAt: string;
  country: string;
  totalFound: number;
  ads: AdData[];
}

const AD_LIBRARY_URL = "https://www.facebook.com/ads/library";

export async function discoverAds(query: string, options: AdsOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = join(options.output, `ads-${timestamp}`);
  const maxAds = parseInt(options.limit, 10);

  console.log(`\n🔍 Searching Facebook Ad Library for: "${query}"`);
  console.log(`📁 Output: ${outputDir}`);
  console.log(`📊 Max ads: ${maxAds}`);
  console.log(`🌍 Country: ${options.country}\n`);

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: options.headless,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "en-US",
  });

  const page = await context.newPage();

  const result: AdsResult = {
    query,
    scrapedAt: new Date().toISOString(),
    country: options.country,
    totalFound: 0,
    ads: [],
  };

  try {
    // Build the search URL
    const searchUrl = buildSearchUrl(query, options.country);
    console.log(`🌐 Loading: ${searchUrl}\n`);

    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3000); // Let the page settle

    // Handle cookie consent if present
    await handleCookieConsent(page);

    // Wait for ads to load
    console.log("⏳ Waiting for ads to load...");
    await page.waitForSelector('[data-testid="ad_library_card"]', { timeout: 30000 }).catch(() => {
      console.log("   ℹ️ No ads found or different page structure");
    });

    // Scroll to load more ads
    let adsCollected = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    while (adsCollected < maxAds && scrollAttempts < maxScrollAttempts) {
      // Extract ads currently visible
      const newAds = await extractAdsFromPage(page, outputDir, adsCollected);

      if (newAds.length === 0) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
      }

      for (const ad of newAds) {
        if (adsCollected >= maxAds) break;
        result.ads.push(ad);
        adsCollected++;
        console.log(`   📸 Ad ${adsCollected}: ${ad.pageName || 'Unknown'} - ${ad.status}`);
      }

      if (adsCollected >= maxAds) break;

      // Scroll down to load more
      await page.evaluate(() => window.scrollBy(0, 1000));
      await page.waitForTimeout(2000);
    }

    result.totalFound = result.ads.length;

    // Save results
    const jsonPath = join(outputDir, "ads.json");
    await writeFile(jsonPath, JSON.stringify(result, null, 2));

    // Generate summary
    const summaryPath = join(outputDir, "summary.md");
    await writeFile(summaryPath, generateAdsSummary(result));

    console.log(`\n✨ Ad discovery complete!`);
    console.log(`   📊 ${result.ads.length} ads captured`);
    console.log(`   📁 Output: ${outputDir}`);
    console.log(`   📄 Data: ${jsonPath}`);

    // Show quick stats
    const activeAds = result.ads.filter((a) => a.status === "active").length;
    const withLandingUrls = result.ads.filter((a) => a.landingUrl).length;
    console.log(`\n📈 Quick Stats:`);
    console.log(`   Active ads: ${activeAds}/${result.ads.length}`);
    console.log(`   With landing URLs: ${withLandingUrls}/${result.ads.length}`);

    if (withLandingUrls > 0) {
      console.log(`\n💡 Tip: Run 'funnel-hacker walk <url>' on the landing URLs to capture their funnels`);
    }

  } catch (error) {
    console.error("\n❌ Error during ad discovery:", error);
    throw error;
  } finally {
    await browser.close();
  }

  return result;
}

function buildSearchUrl(query: string, country: string): string {
  const params = new URLSearchParams({
    active_status: "all",
    ad_type: "all",
    country: country,
    q: query,
    sort_data: JSON.stringify({ direction: "desc", mode: "relevancy_monthly_grouped" }),
    search_type: "keyword_unordered",
    media_type: "all",
  });

  return `${AD_LIBRARY_URL}/?${params.toString()}`;
}

async function handleCookieConsent(page: Page) {
  try {
    const consentButton = await page.$('button[data-cookiebanner="accept_button"]');
    if (consentButton) {
      await consentButton.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No consent banner or already accepted
  }
}

async function extractAdsFromPage(
  page: Page,
  outputDir: string,
  startIndex: number
): Promise<AdData[]> {
  const ads: AdData[] = [];

  try {
    // Get all ad cards
    const adCards = await page.$$('[data-testid="ad_library_card"]');

    // Skip already processed ads
    const newCards = adCards.slice(startIndex);

    for (let i = 0; i < newCards.length; i++) {
      const card = newCards[i];
      const adIndex = startIndex + i;

      try {
        const adData = await extractAdData(card, page);

        // Take screenshot of the ad card
        const screenshotPath = `ad-${adIndex + 1}.png`;
        await card.screenshot({ path: join(outputDir, screenshotPath) });
        adData.screenshotPath = screenshotPath;
        adData.id = `ad-${adIndex + 1}`;

        ads.push(adData);
      } catch (error) {
        console.warn(`   ⚠️ Failed to extract ad ${adIndex + 1}:`, error);
      }
    }
  } catch (error) {
    console.warn("   ⚠️ Error extracting ads:", error);
  }

  return ads;
}

async function extractAdData(card: any, page: Page): Promise<AdData> {
  const adData: AdData = {
    id: "",
    pageId: "",
    pageName: "",
    status: "active",
    platforms: [],
    mediaType: "unknown",
  };

  try {
    // Extract page name
    const pageNameEl = await card.$('a[href*="/ads/library/?active_status"]');
    if (pageNameEl) {
      adData.pageName = await pageNameEl.textContent() || "";
    }

    // Extract status (look for "Active" or "Inactive" text)
    const statusText = await card.textContent();
    if (statusText?.toLowerCase().includes("inactive")) {
      adData.status = "inactive";
    }

    // Extract start date
    const dateMatch = statusText?.match(/Started running on ([A-Za-z]+ \d+, \d+)/);
    if (dateMatch) {
      adData.startDate = dateMatch[1];
    }

    // Extract platforms
    const platformIcons = await card.$$('img[alt*="Platform"]');
    for (const icon of platformIcons) {
      const alt = await icon.getAttribute("alt");
      if (alt) {
        adData.platforms.push(alt.replace("Platform: ", ""));
      }
    }

    // If no platform icons, check for text mentions
    if (adData.platforms.length === 0) {
      if (statusText?.includes("Facebook")) adData.platforms.push("Facebook");
      if (statusText?.includes("Instagram")) adData.platforms.push("Instagram");
      if (statusText?.includes("Messenger")) adData.platforms.push("Messenger");
      if (statusText?.includes("Audience Network")) adData.platforms.push("Audience Network");
    }

    // Extract primary text (ad body)
    const primaryTextEl = await card.$('div[data-testid="ad_library_preview_body"]');
    if (primaryTextEl) {
      adData.primaryText = await primaryTextEl.textContent() || undefined;
    }

    // Alternative: look for the main ad text container
    if (!adData.primaryText) {
      const textContainers = await card.$$('span');
      for (const container of textContainers) {
        const text = await container.textContent();
        if (text && text.length > 50 && text.length < 1000) {
          adData.primaryText = text;
          break;
        }
      }
    }

    // Extract CTA button text
    const ctaEl = await card.$('div[role="button"]');
    if (ctaEl) {
      const ctaText = await ctaEl.textContent();
      if (ctaText && ["Learn More", "Shop Now", "Sign Up", "Download", "Book Now", "Contact Us", "Get Offer", "Watch More"].some(cta => ctaText.includes(cta))) {
        adData.ctaButton = ctaText.trim();
      }
    }

    // Extract landing URL
    const linkEl = await card.$('a[href*="l.facebook.com"]');
    if (linkEl) {
      const href = await linkEl.getAttribute("href");
      if (href) {
        // Decode the Facebook redirect URL
        const urlMatch = href.match(/u=([^&]+)/);
        if (urlMatch) {
          adData.landingUrl = decodeURIComponent(urlMatch[1]);
        }
      }
    }

    // Check for video
    const videoEl = await card.$('video');
    if (videoEl) {
      adData.mediaType = "video";
    } else {
      const imgEl = await card.$('img[src*="scontent"]');
      if (imgEl) {
        adData.mediaType = "image";
      }
    }

    // Check for carousel
    const carouselIndicator = await card.$('[aria-label*="carousel"]');
    if (carouselIndicator) {
      adData.mediaType = "carousel";
    }

  } catch (error) {
    // Continue with partial data
  }

  return adData;
}

function generateAdsSummary(result: AdsResult): string {
  const activeAds = result.ads.filter((a) => a.status === "active");
  const inactiveAds = result.ads.filter((a) => a.status === "inactive");

  // Group by page name
  const byPage = result.ads.reduce((acc, ad) => {
    const page = ad.pageName || "Unknown";
    if (!acc[page]) acc[page] = [];
    acc[page].push(ad);
    return acc;
  }, {} as Record<string, AdData[]>);

  // Find longest-running ads (likely winners)
  const withDates = result.ads.filter((a) => a.startDate);
  withDates.sort((a, b) => {
    const dateA = new Date(a.startDate!);
    const dateB = new Date(b.startDate!);
    return dateA.getTime() - dateB.getTime();
  });

  return `# Facebook Ad Library Results

**Query:** ${result.query}
**Scraped:** ${result.scrapedAt}
**Country:** ${result.country}
**Total Ads Found:** ${result.totalFound}

## Summary Stats

- **Active Ads:** ${activeAds.length}
- **Inactive Ads:** ${inactiveAds.length}
- **Unique Pages:** ${Object.keys(byPage).length}

## Pages Found

${Object.entries(byPage)
  .map(
    ([page, ads]) => `### ${page}
- Total Ads: ${ads.length}
- Active: ${ads.filter((a) => a.status === "active").length}
`
  )
  .join("\n")}

## Longest Running Ads (Likely Winners)

${withDates
  .slice(0, 5)
  .map(
    (ad, i) => `${i + 1}. **${ad.pageName}** - Started ${ad.startDate}
   - Status: ${ad.status}
   - ${ad.primaryText?.slice(0, 100)}...
   ${ad.landingUrl ? `- Landing: ${ad.landingUrl}` : ""}
`
  )
  .join("\n")}

## Landing URLs to Funnel Hack

${result.ads
  .filter((a) => a.landingUrl)
  .map((a) => `- ${a.landingUrl}`)
  .filter((url, i, arr) => arr.indexOf(url) === i)
  .join("\n")}

## Ad Screenshots

${result.ads.map((a) => `- ${a.screenshotPath}: ${a.pageName} (${a.status})`).join("\n")}
`;
}

export async function listAds(outputDir: string) {
  console.log(`\n📊 Listing ads from: ${outputDir}\n`);

  try {
    const jsonPath = join(outputDir, "ads.json");
    const content = await Bun.file(jsonPath).text();
    const result: AdsResult = JSON.parse(content);

    console.log(`Query: "${result.query}"`);
    console.log(`Total: ${result.totalFound} ads\n`);

    for (const ad of result.ads) {
      console.log(`${ad.id}: ${ad.pageName}`);
      console.log(`   Status: ${ad.status} | Started: ${ad.startDate || "Unknown"}`);
      console.log(`   Platforms: ${ad.platforms.join(", ") || "Unknown"}`);
      if (ad.landingUrl) {
        console.log(`   Landing: ${ad.landingUrl}`);
      }
      console.log();
    }
  } catch (error) {
    console.error("Failed to read ads data:", error);
  }
}
