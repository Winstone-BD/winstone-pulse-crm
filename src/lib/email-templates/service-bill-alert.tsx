import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  /** Alert headline, already localised by the caller. */
  title?: string;
  /** Supporting sentence with due / grace dates. */
  detail?: string;
  period?: string;
  amount?: string;
  stageLabel?: string;
  reviewUrl?: string;
}

const Email = ({ title, detail, period, amount, stageLabel, reviewUrl }: Props) => (
  <Html lang="bn" dir="ltr">
    <Head />
    <Preview>{title || "সার্ভিস বিল সংক্রান্ত জরুরি তথ্য"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Winstone CRM</Text>
        <Heading style={heading}>{title || "সার্ভিস বিল আপডেট"}</Heading>
        <Text style={text}>{detail || "বিস্তারিত IT কনসোলে দেখুন।"}</Text>
        <Section style={box}>
          {period ? <Text style={row}>পিরিয়ড: {period}</Text> : null}
          {amount ? <Text style={row}>পরিমাণ: {amount}</Text> : null}
          {stageLabel ? <Text style={row}>অবস্থা: {stageLabel}</Text> : null}
        </Section>
        <Button
          href={reviewUrl || "https://crm1.winstonebd.com/service-bill-unlock"}
          style={button}
        >
          Secure human review
        </Button>
        <Text style={muted}>
          এই alert কোনো payment, transfer বা automatic approval সম্পন্ন করে না।
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    typeof data["title"] === "string" && data["title"]
      ? data["title"]
      : "Winstone CRM — সার্ভিস বিল আপডেট",
  displayName: "Service bill alert",
  previewData: {
    title: "2026-10 সার্ভিস বিল বকেয়া — $46.29 USD",
    detail: "আজ মেয়াদ শেষ; ১৮ অক্টোবর পর্যন্ত গ্রেস।",
    period: "2026-10",
    amount: "$46.29 USD",
    stageLabel: "মেয়াদ শেষ",
    reviewUrl: "https://crm1.winstonebd.com/service-bill-unlock",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "24px 28px", maxWidth: "560px" };
const brand = { fontSize: "12px", letterSpacing: "2px", color: "#8a6a1f", margin: "0 0 8px" };
const heading = { fontSize: "20px", color: "#1a1a1a", margin: "0 0 12px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#333333" };
const box = {
  backgroundColor: "#faf6ec",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "16px 0",
};
const row = { fontSize: "14px", color: "#4a4a4a", margin: "4px 0" };
const muted = { fontSize: "13px", color: "#6b6b6b", lineHeight: "20px" };
const button = {
  backgroundColor: "#8a6a1f",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "12px 18px",
  textDecoration: "none",
};
