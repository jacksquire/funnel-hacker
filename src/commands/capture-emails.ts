import { chromium, type Page } from "playwright";
import { mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";

interface EmailCaptureOptions {
  output: string;
  days: string;
  headless: boolean;
  email?: string;
  tempEmail: boolean;
}

interface CapturedEmail {
  id: string;
  from: string;
  subject: string;
  receivedAt: string;
  body: string;
  htmlBody?: string;
  links: string[];
  hasUnsubscribe: boolean;
  dayInSequence: number;
}

interface EmailSequence {
  funnelUrl: string;
  signupEmail: string;
  captureStarted: string;
  captureEnded?: string;
  totalEmails: number;
  emails: CapturedEmail[];
}

// Temp email service (using mail.tm - free, no signup required)
const TEMP_EMAIL_API = "https://api.mail.tm";

export async function captureEmails(funnelUrl: string, options: EmailCaptureOptions) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputDir = join(options.output, `emails-${timestamp}`);
  const maxDays = parseInt(options.days, 10);

  console.log(`\n📧 Starting email capture for: ${funnelUrl}`);
  console.log(`📁 Output: ${outputDir}`);
  console.log(`⏱️ Capture duration: ${maxDays} days\n`);

  await mkdir(outputDir, { recursive: true });

  let email: string;
  let emailPassword: string | undefined;
  let tempEmailToken: string | undefined;

  // Get or create email address
  if (options.email) {
    email = options.email;
    console.log(`📬 Using provided email: ${email}`);
  } else if (options.tempEmail) {
    console.log(`🔄 Creating temporary email address...`);
    const tempEmail = await createTempEmail();
    email = tempEmail.address;
    emailPassword = tempEmail.password;
    tempEmailToken = tempEmail.token;
    console.log(`📬 Temporary email: ${email}`);
  } else {
    console.error("❌ No email provided. Use --email=your@email.com or --temp-email");
    process.exit(1);
  }

  const sequence: EmailSequence = {
    funnelUrl,
    signupEmail: email,
    captureStarted: new Date().toISOString(),
    totalEmails: 0,
    emails: [],
  };

  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  try {
    // Step 1: Sign up through the funnel
    console.log(`\n🚀 Signing up through funnel...`);
    const page = await context.newPage();
    await signUpThroughFunnel(page, funnelUrl, email);
    await page.close();

    console.log(`✅ Signup complete!`);
    console.log(`\n⏳ Now monitoring for emails...`);
    console.log(`   (This will run for ${maxDays} days or until you stop it)\n`);

    // Step 2: Monitor for emails
    if (tempEmailToken) {
      await monitorTempEmails(tempEmailToken, sequence, outputDir, maxDays);
    } else {
      console.log(`\n⚠️ Manual email monitoring required.`);
      console.log(`   Forward emails from ${email} to this tool, or use --temp-email flag.`);

      // Save what we have and instructions
      await saveEmailInstructions(email, funnelUrl, outputDir);
    }

    // Save final results
    sequence.captureEnded = new Date().toISOString();
    sequence.totalEmails = sequence.emails.length;

    const jsonPath = join(outputDir, "email-sequence.json");
    await writeFile(jsonPath, JSON.stringify(sequence, null, 2));

    const reportPath = join(outputDir, "email-report.md");
    await writeFile(reportPath, generateEmailReport(sequence));

    console.log(`\n✨ Email capture complete!`);
    console.log(`   📊 ${sequence.totalEmails} emails captured`);
    console.log(`   📁 Output: ${outputDir}`);

  } catch (error) {
    console.error("\n❌ Error during email capture:", error);
    throw error;
  } finally {
    await browser.close();
  }

  return sequence;
}

async function createTempEmail(): Promise<{ address: string; password: string; token: string }> {
  try {
    // Get available domains
    const domainsRes = await fetch(`${TEMP_EMAIL_API}/domains`);
    const domainsData = await domainsRes.json();
    const domain = domainsData["hydra:member"]?.[0]?.domain || "mail.tm";

    // Generate random address
    const username = `funnelhacker${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const address = `${username}@${domain}`;
    const password = `FH${Date.now()}!`;

    // Create account
    const createRes = await fetch(`${TEMP_EMAIL_API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create temp email: ${createRes.status}`);
    }

    // Get token
    const tokenRes = await fetch(`${TEMP_EMAIL_API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const tokenData = await tokenRes.json();

    return {
      address,
      password,
      token: tokenData.token,
    };
  } catch (error) {
    console.error("Failed to create temp email:", error);
    // Fallback: return a placeholder
    return {
      address: `funnelhacker${Date.now()}@example.com`,
      password: "placeholder",
      token: "",
    };
  }
}

async function signUpThroughFunnel(page: Page, url: string, email: string) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Look for email input fields
  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name*="email"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="Email" i]',
    'input#email',
    'input.email',
  ];

  let emailInput = null;
  for (const selector of emailSelectors) {
    emailInput = await page.$(selector);
    if (emailInput) break;
  }

  if (!emailInput) {
    console.log("   ⚠️ No email input found on page. Taking screenshot for manual review.");
    await page.screenshot({ path: "signup-page.png", fullPage: true });
    return;
  }

  // Fill email
  await emailInput.fill(email);
  console.log(`   ✏️ Filled email: ${email}`);

  // Look for name field (optional)
  const nameInput = await page.$('input[name="name"], input[name*="name"], input[placeholder*="name" i]');
  if (nameInput) {
    await nameInput.fill("Funnel Hacker");
    console.log(`   ✏️ Filled name: Funnel Hacker`);
  }

  // Find and click submit button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Sign Up")',
    'button:has-text("Get Access")',
    'button:has-text("Download")',
    'button:has-text("Yes")',
    '.btn-primary',
    '.cta-button',
  ];

  let submitButton = null;
  for (const selector of submitSelectors) {
    submitButton = await page.$(selector);
    if (submitButton && await submitButton.isVisible()) break;
  }

  if (submitButton) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }).catch(() => {}),
      submitButton.click(),
    ]);
    console.log(`   🖱️ Clicked submit button`);
    await page.waitForTimeout(3000);

    // Screenshot the thank you page
    await page.screenshot({ path: join(process.cwd(), "signup-confirmation.png"), fullPage: true });
    console.log(`   📸 Captured confirmation page`);
  } else {
    console.log("   ⚠️ No submit button found");
  }
}

async function monitorTempEmails(
  token: string,
  sequence: EmailSequence,
  outputDir: string,
  maxDays: number
) {
  const startTime = Date.now();
  const maxDuration = maxDays * 24 * 60 * 60 * 1000;
  let lastCheck = 0;
  const checkInterval = 30 * 1000; // Check every 30 seconds
  const seenIds = new Set<string>();

  console.log(`\n📬 Monitoring emails (checking every 30 seconds)...`);
  console.log(`   Press Ctrl+C to stop early\n`);

  while (Date.now() - startTime < maxDuration) {
    try {
      const res = await fetch(`${TEMP_EMAIL_API}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const messages = data["hydra:member"] || [];

        for (const msg of messages) {
          if (seenIds.has(msg.id)) continue;
          seenIds.add(msg.id);

          // Fetch full message
          const fullRes = await fetch(`${TEMP_EMAIL_API}/messages/${msg.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (fullRes.ok) {
            const fullMsg = await fullRes.json();

            const capturedEmail: CapturedEmail = {
              id: msg.id,
              from: fullMsg.from?.address || "unknown",
              subject: fullMsg.subject || "(no subject)",
              receivedAt: fullMsg.createdAt || new Date().toISOString(),
              body: fullMsg.text || "",
              htmlBody: fullMsg.html?.[0] || undefined,
              links: extractLinks(fullMsg.text || fullMsg.html?.[0] || ""),
              hasUnsubscribe: (fullMsg.text || "").toLowerCase().includes("unsubscribe"),
              dayInSequence: Math.ceil((Date.now() - startTime) / (24 * 60 * 60 * 1000)),
            };

            sequence.emails.push(capturedEmail);
            console.log(`   📩 New email: "${capturedEmail.subject}" from ${capturedEmail.from}`);

            // Save individual email
            const emailPath = join(outputDir, `email-${sequence.emails.length}.json`);
            await writeFile(emailPath, JSON.stringify(capturedEmail, null, 2));
          }
        }
      }
    } catch (error) {
      console.warn("   ⚠️ Error checking emails:", error);
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, checkInterval));

    // Progress indicator
    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
    if (elapsed > 0 && elapsed % 60 === 0) {
      console.log(`   ⏱️ ${Math.round(elapsed / 60)} hours elapsed, ${sequence.emails.length} emails captured`);
    }
  }
}

function extractLinks(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const matches = text.match(urlRegex) || [];
  // Deduplicate and filter out common non-funnel links
  return [...new Set(matches)].filter(
    (url) =>
      !url.includes("unsubscribe") &&
      !url.includes("mail.google.com") &&
      !url.includes("facebook.com/tr") &&
      !url.includes("mailchimp.com") &&
      !url.includes("list-manage.com")
  );
}

async function saveEmailInstructions(email: string, funnelUrl: string, outputDir: string) {
  const instructions = `# Manual Email Capture Instructions

Since you're using your own email (${email}), follow these steps:

## Signup Complete
You've been signed up at: ${funnelUrl}

## To Capture Emails

1. **Forward emails** to this folder as .eml files
2. Or **copy/paste** the content into individual files named:
   - email-1.txt
   - email-2.txt
   - etc.

3. Run the analyzer when done:
   \`\`\`bash
   funnel-hacker analyze-emails ${outputDir}
   \`\`\`

## What to Capture

For each email, note:
- Subject line
- Sender
- Date/time received
- Full body text
- All links in the email

## Tip

Create a filter to auto-label/folder these emails for easy tracking.
`;

  await writeFile(join(outputDir, "INSTRUCTIONS.md"), instructions);
  console.log(`\n📝 Instructions saved to: ${outputDir}/INSTRUCTIONS.md`);
}

function generateEmailReport(sequence: EmailSequence): string {
  // Analyze timing
  const emailsByDay: Record<number, CapturedEmail[]> = {};
  for (const email of sequence.emails) {
    const day = email.dayInSequence;
    if (!emailsByDay[day]) emailsByDay[day] = [];
    emailsByDay[day].push(email);
  }

  // Analyze senders
  const senders = [...new Set(sequence.emails.map((e) => e.from))];

  // Analyze subject line patterns
  const subjectPatterns = {
    questions: sequence.emails.filter((e) => e.subject.includes("?")).length,
    urgency: sequence.emails.filter((e) =>
      /urgent|last chance|ending|expires|final/i.test(e.subject)
    ).length,
    personalization: sequence.emails.filter((e) =>
      /\{|{{|[name]|[first/i.test(e.subject)
    ).length,
    numbers: sequence.emails.filter((e) => /\d/.test(e.subject)).length,
  };

  return `# Email Sequence Analysis

**Funnel:** ${sequence.funnelUrl}
**Signup Email:** ${sequence.signupEmail}
**Capture Period:** ${sequence.captureStarted} to ${sequence.captureEnded || "ongoing"}
**Total Emails:** ${sequence.totalEmails}

## Sequence Overview

### Emails by Day

${Object.entries(emailsByDay)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(
    ([day, emails]) => `**Day ${day}:** ${emails.length} email(s)
${emails.map((e) => `  - "${e.subject}"`).join("\n")}`
  )
  .join("\n\n")}

## Subject Line Analysis

| Pattern | Count | % |
|---------|-------|---|
| Questions (?) | ${subjectPatterns.questions} | ${Math.round((subjectPatterns.questions / sequence.totalEmails) * 100)}% |
| Urgency words | ${subjectPatterns.urgency} | ${Math.round((subjectPatterns.urgency / sequence.totalEmails) * 100)}% |
| Contains numbers | ${subjectPatterns.numbers} | ${Math.round((subjectPatterns.numbers / sequence.totalEmails) * 100)}% |

## All Subject Lines

${sequence.emails
  .map(
    (e, i) => `${i + 1}. **"${e.subject}"**
   - From: ${e.from}
   - Day: ${e.dayInSequence}
   - Links: ${e.links.length}
   - Has unsubscribe: ${e.hasUnsubscribe ? "Yes" : "No"}`
  )
  .join("\n\n")}

## Senders

${senders.map((s) => `- ${s} (${sequence.emails.filter((e) => e.from === s).length} emails)`).join("\n")}

## Links Found

${[...new Set(sequence.emails.flatMap((e) => e.links))]
  .map((link) => `- ${link}`)
  .join("\n")}

## Full Email Bodies

${sequence.emails
  .map(
    (e, i) => `### Email ${i + 1}: ${e.subject}

**From:** ${e.from}
**Received:** ${e.receivedAt}
**Day in sequence:** ${e.dayInSequence}

\`\`\`
${e.body.slice(0, 2000)}${e.body.length > 2000 ? "...(truncated)" : ""}
\`\`\`

---`
  )
  .join("\n\n")}
`;
}
