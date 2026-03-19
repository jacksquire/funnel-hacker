export interface FunnelStep {
  step: number;
  url: string;
  title: string;
  screenshot: string;
  timestamp: string;
  ctaText?: string;
  forms?: string[];
  analysis?: StepAnalysis;
}

export interface StepAnalysis {
  pageType: PageType;
  headline?: string;
  subheadline?: string;
  copyHighlights: string[];
  designNotes: string[];
  psychologyTactics: string[];
  strengths: string[];
  weaknesses: string[];
}

export type PageType =
  | "landing"
  | "optin"
  | "sales"
  | "vsl"
  | "webinar"
  | "checkout"
  | "upsell"
  | "downsell"
  | "thankyou"
  | "confirmation"
  | "quiz"
  | "application"
  | "other";

export interface FunnelData {
  id: string;
  startUrl: string;
  startedAt: string;
  completedAt?: string;
  steps: FunnelStep[];
  metadata: FunnelMetadata;
}

export interface FunnelMetadata {
  advertiser?: string;
  funnelType?: FunnelType;
  estimatedValue?: string;
  industry?: string;
  notes?: string;
}

export type FunnelType =
  | "webinar"
  | "vsl"
  | "quiz"
  | "application"
  | "ecommerce"
  | "leadgen"
  | "tripwire"
  | "challenge"
  | "other";

export interface AdData {
  id: string;
  pageId: string;
  pageName: string;
  creativeType: "image" | "video" | "carousel";
  primaryText?: string;
  headline?: string;
  description?: string;
  ctaType?: string;
  landingUrl?: string;
  startDate?: string;
  isActive: boolean;
  screenshotUrl?: string;
  platforms: string[];
}

export interface ReportConfig {
  title: string;
  subtitle?: string;
  author?: string;
  date: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    fontFamily?: string;
  };
}
