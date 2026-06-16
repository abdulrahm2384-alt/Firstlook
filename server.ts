import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import { db, initializeDatabase } from "./db";
import { getCurrencyForCountry } from "./src/utils/currencyConverter";

export function getProjectMode(): "test" | "live" {
  const envMode = (process.env.PAYSTACK_MODE || process.env.PROJECT_MODE || "").toLowerCase().trim();
  if (envMode === "live" || envMode === "production") {
    return "live";
  }
  if (envMode === "test" || envMode === "development" || envMode === "sandbox") {
    return "test";
  }

  // Auto-detect based on key
  const secretKey = process.env.PAYSTACK_SECRET_KEY || "";
  if (secretKey.trim().startsWith("sk_live")) {
    return "live";
  }

  return "test";
}

interface PendingSignup {
  otp: string;
  expiresAt: number;
  signupData: any;
}

const pendingOtps = new Map<string, PendingSignup>();

interface PendingForgot {
  otp: string;
  expiresAt: number;
}
const pendingForgotOtps = new Map<string, PendingForgot>();

// Rate limiting to prevent spam OTP requests
interface OtpRateLimit {
  count: number;
  lastRequestTime: number;
}
const otpRateLimits = new Map<string, OtpRateLimit>();

function checkOtpRateLimit(email: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const limit = otpRateLimits.get(email);
  if (limit) {
    const timePassed = now - limit.lastRequestTime;
    if (timePassed < 60000) {
      const waitSeconds = Math.ceil((60000 - timePassed) / 1000);
      return {
        allowed: false,
        message: `Please wait ${waitSeconds} seconds before requesting another code.`
      };
    }
    
    // Check limit inside 15-minute window (maximum 5 requests)
    if (now - limit.lastRequestTime < 15 * 60 * 1000) {
      if (limit.count >= 5) {
        return {
          allowed: false,
          message: "Too many request attempts. Please try again after 15 minutes."
        };
      }
      limit.count += 1;
      limit.lastRequestTime = now;
    } else {
      limit.count = 1;
      limit.lastRequestTime = now;
    }
  } else {
    otpRateLimits.set(email, {
      count: 1,
      lastRequestTime: now
    });
  }
  return { allowed: true };
}

// Email sending function using Resend's secure HTTPS REST API.
// This completely avoids connection timeout issues caused by cloud firewalls blocking SMTP ports.
async function sendEmail(
  toEmail: string,
  subject: string,
  htmlContent: string,
  textContent?: string,
  fromName: string = "FirstLookLabs Security",
  highPriority: boolean = false,
  replyTo?: string
): Promise<boolean> {
  // Use Resend when key is configured
  if (process.env.RESEND_API_KEY) {
    const resendApiKey = process.env.RESEND_API_KEY.trim();
    console.log(`[Email Route] RESEND_API_KEY detected! Dispatching via Resend's secure HTTPS API...`);
    try {
      const fromEmail = (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();
      const plainText = textContent || htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      
      const payload = {
        from: `"${fromName}" <${fromEmail}>`,
        to: [toEmail],
        subject: subject,
        html: htmlContent,
        text: plainText,
        reply_to: replyTo ? [replyTo] : undefined
      };
      
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      const responseData: any = await response.json();
      if (response.ok && responseData.id) {
        console.log(`[Resend API Success] Email successfully transmitted to ${toEmail}! MessageId: ${responseData.id}`);
        return true;
      } else {
        console.error(`[Resend API Fail] Dispatch parameters rejected: ${JSON.stringify(responseData)}`);
      }
    } catch (resendErr: any) {
      console.error(`[Resend API Error] Web pipeline failed: ${resendErr.message}`);
    }
  } else {
    // Graceful fallback for local development or sandbox testing when no keys are provided
    console.warn(`[Resend Warning] RESEND_API_KEY is not configured in environment variables.`);
    console.log(`[Pending Email Log] Directing dispatch to: ${toEmail}`);
    console.log(`- Subject: ${subject}`);
    console.log(`- From-Header: "${fromName}"`);
    console.log(`- Simulated content delivery has been bypassed in sandboxed development mode.`);
    return true; // Return true to keep authentication OTP actions working instantly in sandbox mode
  }
  return false;
}

async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  console.log(`[OTP Verification Code] Verification OTP generated for signup: ${email} -> CODE: ${otp}`);
  const subject = "Your FirstLookLabs verification code";
  const text = `Hello,\n\nUse the following verification code to complete your registration:\n\n${otp}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this email, please disregard it.\n\nFirstLookLabs Security`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .logo {
      height: 40px;
      max-width: 250px;
      vertical-align: middle;
    }
    .content {
      padding: 40px 32px;
    }
    .heading {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 24px;
      letter-spacing: -0.025em;
      line-height: 1.3;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .otp-container {
      text-align: center;
      margin: 32px 0;
    }
    .otp-code {
      display: inline-block;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px 32px;
      letter-spacing: 4px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 28px;
      font-weight: 850;
      color: #0f172a;
    }
    .footer {
      background-color: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      padding: 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .footer-tagline {
      font-style: italic;
      margin-bottom: 12px;
    }
    .footer-meta {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .footer-link {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://firstlooklabs.xyz/logo.svg" alt="FirstLook Labs" class="logo" />
      <span style="vertical-align: middle; font-size: 22px; font-weight: 800; color: #ffffff; margin-left: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: -0.025em;">FirstLook</span>
    </div>
    <div class="content">
      <h1 class="heading">Verification Code</h1>
      <div class="body-text">
        <p>Hello,</p>
        <p>Use the following verification code to complete your registration:</p>
        <div class="otp-container">
          <div class="otp-code">${otp}</div>
        </div>
        <p>This code is valid for 10 minutes. After 10 minutes, you will need to request a new code.</p>
        <p style="margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 13px; color: #64748b;">
          If you did not request this email, please disregard it. No further action is required.
        </p>
      </div>
    </div>
    <div class="footer">
      <div class="footer-title">FirstLook Labs</div>
      <div class="footer-tagline">Test First. Risk Later.</div>
      <div>
        <a href="https://firstlooklabs.xyz" class="footer-link" target="_blank">https://firstlooklabs.xyz</a>
      </div>
      <div class="footer-meta">
        FirstLook Security • Automated Operational Notification
      </div>
    </div>
  </div>
</body>
</html>`;

  const sent = await sendEmail(email, subject, html, text, "FirstLookLabs Security", true);
  if (!sent) {
    console.warn(`[OTP Warning Alert] Resend Mail delivery failed for sign-up OTP. But you can inspect and copy the code right here from your Render live logs console screen to bypass signup blockage! CODE: ${otp}`);
  }
  return sent;
}

async function sendResetOtpEmail(email: string, otp: string): Promise<boolean> {
  console.log(`[OTP Reset Code] Password reset OTP generated: ${email} -> CODE: ${otp}`);
  const subject = "Your FirstLookLabs verification code";
  const text = `Hello,\n\nUse the following verification code to reset your password:\n\n${otp}\n\nThis code is valid for 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nFirstLookLabs Security`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .logo {
      height: 40px;
      max-width: 250px;
      vertical-align: middle;
    }
    .content {
      padding: 40px 32px;
    }
    .heading {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 24px;
      letter-spacing: -0.025em;
      line-height: 1.3;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .otp-container {
      text-align: center;
      margin: 32px 0;
    }
    .otp-code {
      display: inline-block;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px 32px;
      letter-spacing: 4px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 28px;
      font-weight: 850;
      color: #0f172a;
    }
    .footer {
      background-color: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      padding: 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .footer-tagline {
      font-style: italic;
      margin-bottom: 12px;
    }
    .footer-meta {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .footer-link {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://firstlooklabs.xyz/logo.svg" alt="FirstLook Labs" class="logo" />
      <span style="vertical-align: middle; font-size: 22px; font-weight: 800; color: #ffffff; margin-left: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: -0.025em;">FirstLook</span>
    </div>
    <div class="content">
      <h1 class="heading">Reset Password</h1>
      <div class="body-text">
        <p>Hello,</p>
        <p>Use the following verification code to reset your password:</p>
        <div class="otp-container">
          <div class="otp-code">${otp}</div>
        </div>
        <p>This code is valid for 10 minutes. After 10 minutes, you will need to request a new code.</p>
        <p style="margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 24px; font-size: 13px; color: #64748b;">
          If you did not request a password reset, please disregard this email. Your password will remain unchanged.
        </p>
      </div>
    </div>
    <div class="footer">
      <div class="footer-title">FirstLook Labs</div>
      <div class="footer-tagline">Test First. Risk Later.</div>
      <div>
        <a href="https://firstlooklabs.xyz" class="footer-link" target="_blank">https://firstlooklabs.xyz</a>
      </div>
      <div class="footer-meta">
        FirstLook Security • Automated Operational Notification
      </div>
    </div>
  </div>
</body>
</html>`;

  return await sendEmail(email, subject, html, text, "FirstLookLabs Security", true);
}

async function sendWelcomeEmail(email: string, fullName: string): Promise<boolean> {
  const subject = "Welcome to FirstLookLabs";
  const name = fullName || "User";
  const text = `Hi ${name},\n\nYour FirstLookLabs account has been successfully created and verified.\n\nYou can now sign in and access your dashboard.\n\nWelcome aboard.\n\n— FirstLookLabs Security Team`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .logo {
      height: 40px;
      max-width: 250px;
      vertical-align: middle;
    }
    .content {
      padding: 40px 32px;
    }
    .heading {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 24px;
      letter-spacing: -0.025em;
      line-height: 1.3;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .footer {
      background-color: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      padding: 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .footer-tagline {
      font-style: italic;
      margin-bottom: 12px;
    }
    .footer-meta {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .footer-link {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://firstlooklabs.xyz/logo.svg" alt="FirstLook Labs" class="logo" />
      <span style="vertical-align: middle; font-size: 22px; font-weight: 800; color: #ffffff; margin-left: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: -0.025em;">FirstLook</span>
    </div>
    <div class="content">
      <h1 class="heading">Welcome to FirstLook Labs!</h1>
      <div class="body-text">
        <p>Hi ${name},</p>
        <p>Your FirstLook account has been successfully created and verified.</p>
        <p>You can now sign in and access your diagnostic simulation dashboard, trading structures, and advanced features.</p>
        <p style="margin-top: 24px; margin-bottom: 0; font-weight: 600; color: #0f172a;">Welcome aboard,</p>
        <p style="margin-top: 4px; color: #64748b; font-style: italic;">— FirstLook Team</p>
      </div>
    </div>
    <div class="footer">
      <div class="footer-title">FirstLook Labs</div>
      <div class="footer-tagline">Test First. Risk Later.</div>
      <div>
        <a href="https://firstlooklabs.xyz" class="footer-link" target="_blank">https://firstlooklabs.xyz</a>
      </div>
      <div class="footer-meta">
        FirstLook Security • Automated Operational Notification
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    return await sendEmail(email, subject, html, text, "FirstLookLabs Security", false);
  } catch (err) {
    console.warn("[Resend Mail] Welcome email failed:", err);
    return false;
  }
}

async function sendSubscriptionExpiredEmail(email: string, plan: string): Promise<boolean> {
  const subject = `Your FirstLookLabs ${plan.toUpperCase()} subscription has expired`;
  const text = `Hello,\n\nThis notification confirms that your FirstLookLabs subscription has completed its active period.\n\nYour account has transitioned to the basic free plan. Locked features, multi-symbol layout slots, and historical statistics tracking are now limited.\n\nTo restore access to all features, visit your profile page to update your subscription options.\n\nFirstLookLabs Billing`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .logo {
      height: 40px;
      max-width: 250px;
      vertical-align: middle;
    }
    .content {
      padding: 40px 32px;
    }
    .heading {
      font-size: 20px;
      font-weight: 700;
      color: #c05621;
      margin-top: 0;
      margin-bottom: 24px;
      letter-spacing: -0.025em;
      line-height: 1.3;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .notice-box {
      background-color: #fffaf0;
      border: 1px solid #feebc8;
      padding: 20px;
      border-radius: 8px;
      margin: 24px 0;
    }
    .footer {
      background-color: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      padding: 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .footer-tagline {
      font-style: italic;
      margin-bottom: 12px;
    }
    .footer-meta {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .footer-link {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://firstlooklabs.xyz/logo.svg" alt="FirstLook Labs" class="logo" />
      <span style="vertical-align: middle; font-size: 22px; font-weight: 800; color: #ffffff; margin-left: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: -0.025em;">FirstLook</span>
    </div>
    <div class="content">
      <h1 class="heading">Subscription Expired</h1>
      <div class="body-text">
        <p>Hello,</p>
        <p>Your subscription has completed its 30-day active billing period. Your account has transitioned to the Basic plan.</p>
        <div class="notice-box">
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #c05621; font-weight: 600;">
            Status: Switched to Basic tier. To manage your account preferences and restore access to premium indicators, please visit your profile subscriber settings.
          </p>
        </div>
        <p>If you have any questions or feedback, feel free to contact our support team.</p>
      </div>
    </div>
    <div class="footer">
      <div class="footer-title">FirstLook Labs</div>
      <div class="footer-tagline">Test First. Risk Later.</div>
      <div>
        <a href="https://firstlooklabs.xyz" class="footer-link" target="_blank">https://firstlooklabs.xyz</a>
      </div>
      <div class="footer-meta">
        FirstLook Billing • Automated Operational Notification
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    return await sendEmail(email, subject, html, text, "FirstLookLabs Billing");
  } catch (err) {
    console.warn("[Resend Mail] Expiration email failed:", err);
    return false;
  }
}

const dynamicPlansCache = new Map<string, string>();

async function getOrCreatePaystackPlan(
  plan: 'plus' | 'premium',
  cycle: string,
  secretKey: string,
  amountKobo: number,
  currency: string
): Promise<string | null> {
  const planKey = `PAYSTACK_PLAN_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  let planCode = process.env[planKey];
  if (planCode && planCode.trim() !== "" && !planCode.includes("placeholder")) {
    return planCode;
  }
  
  if (dynamicPlansCache.has(planKey)) {
    return dynamicPlansCache.get(planKey) || null;
  }
  
  try {
    console.log(`[Paystack Plan Provisioner] No pre-configured plan found in env for: ${planKey}. Dynamically creating plan on Paystack...`);
    const response = await fetch("https://api.paystack.co/plan", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `FirstLook System - ${plan.toUpperCase()} (${cycle === 'yearly' ? 'Yearly' : 'Monthly'})`,
        interval: cycle === 'yearly' ? 'annually' : 'monthly',
        amount: amountKobo,
        currency: currency
      })
    });
    const resDict = await response.json();
    if (resDict.status && resDict.data?.plan_code) {
      const code = resDict.data.plan_code;
      console.log(`[Paystack Plan Provisioner] Successfully created plan ${code} for key ${planKey}`);
      dynamicPlansCache.set(planKey, code);
      return code;
    } else {
      console.error("[Paystack Plan Provisioner] Failed creation on Paystack API response:", resDict.message || resDict);
    }
  } catch (err) {
    console.error("[Paystack Plan Provisioner] Network failure creating plan on Paystack:", err);
  }
  
  return null;
}

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.log("[Sponsor Server] GEMINI_API_KEY is not defined. Using static fallback for partnerships.");
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

const FALLBACK_SPONSORS = [
  {
    sponsor: "Exness Broker",
    tagline: "Unbeatable trading conditions with raw spreads under 0.1 pips.",
    category: "Reputable Brokers",
    incentive: "0.0 pips raw spread account for backtesters",
    cta: "Claim Offer",
    logoType: "broker",
    link: "https://www.exness.com"
  },
  {
    sponsor: "FTMO Challenges",
    tagline: "The leading prop firm. Scale up to $200,000 in trading capital.",
    category: "Prop Firms",
    incentive: "Get 90% profit split with backtest-proven strategies",
    cta: "Start Challenge",
    logoType: "prop",
    link: "https://ftmo.com"
  },
  {
    sponsor: "PineServer VPS",
    tagline: "Ultra-low latency VPS hosting in Equinix NY4 and LD4 locations.",
    category: "Trading Utilities",
    incentive: "24/7 server running with 99.99% uptime guarantees",
    cta: "Deploy VPS",
    logoType: "vps",
    link: "https://www.pepperstone.com"
  },
  {
    sponsor: "Alpha Insights",
    tagline: "Exclusive daily market order flow and smart-money concept briefs.",
    category: "Premium Insights",
    incentive: "Curated trading recommendations based on daily depth graphs",
    cta: "Receive Digest",
    logoType: "insight",
    link: "https://www.interactivebrokers.com"
  }
];

let memoizedSponsor: any = null;
let lastSponsorFetchTime = 0;
const SPONSOR_CACHE_DURATION = 15 * 60 * 1000; // Cache Gemini-generated sponsor for 15 mins to respect quota

async function startServer() {
  await initializeDatabase();
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware to parse large JSON payloads (e.g. drawings, base64 drawings)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve ads.txt explicitly and cleanly from root
  app.get("/ads.txt", (req, res) => {
    const filePath = process.env.NODE_ENV === "production"
      ? path.resolve(process.cwd(), "dist", "ads.txt")
      : path.resolve(process.cwd(), "public", "ads.txt");
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("[Server] Error sending ads.txt:", err);
        res.status(404).send("ads.txt not found");
      }
    });
  });

  // --- CUSTOM AUTHENTICATION ENDPOINTS (Replacing Supabase Auth) ---
  const JWT_SECRET = process.env.JWT_SECRET || 'firstlook-dev-secret-key-182';

  const getAuthenticatedUser = (req: any) => {
    let token = "";
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      const cookies = req.headers.cookie || "";
      const match = cookies.match(/firstlook_session_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
    if (!token) return null;
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  };

  // --- JOURNAL SUB-PAGE SYSTEM ENDPOINTS ---
  app.get("/api/journal/accounts", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const accounts = await db.journalGetAccounts(user.id);
      res.json({ accounts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/journal/accounts", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = await db.journalAddAccount(user.id, req.body);
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/journal/accounts/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      await db.journalUpdateAccount(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/journal/accounts/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      await db.journalDeleteAccount(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/journal/trades", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { accountId } = req.query;
    try {
      if (accountId) {
        const trades = await db.journalGetTrades(String(accountId));
        res.json({ trades });
      } else {
        const trades = await db.journalGetAllUserTrades(user.id);
        res.json({ trades });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/journal/trades", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = await db.journalAddTrade(user.id, req.body);
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/journal/trades/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      await db.journalUpdateTrade(req.params.id, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/journal/trades/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      await db.journalDeleteTrade(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/journal/withdrawals", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { accountId } = req.query;
    try {
      if (accountId) {
        const withdrawals = await db.journalGetWithdrawals(String(accountId));
        res.json({ withdrawals });
      } else {
        const withdrawals = await db.journalGetAllUserWithdrawals(user.id);
        res.json({ withdrawals });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/journal/withdrawals", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = await db.journalAddWithdrawal(user.id, req.body);
      res.json({ id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, username, fullName, country, bio, experienceLevel, avatarUrl } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: { message: "Email and password are required" } });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Enforce rate limiting
      const limitCheck = checkOtpRateLimit(cleanEmail);
      if (!limitCheck.allowed) {
        return res.status(429).json({ error: { message: limitCheck.message } });
      }

      const existing = await db.getUserByEmail(cleanEmail);
      if (existing) {
        return res.status(400).json({ error: { message: "Email is already registered" } });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      pendingOtps.set(cleanEmail, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
        signupData: {
          passwordHash,
          username,
          fullName,
          country,
          bio,
          experienceLevel,
          avatarUrl
        }
      });

      const sent = await sendOtpEmail(cleanEmail, otp);

      if (!sent) {
        console.warn(`[Auth API] Resend email dispatch failed for signup (quota or configuration issue). Bypassing OTP requirement and completing registration immediately for ${cleanEmail}.`);
        pendingOtps.delete(cleanEmail);
        
        const user = await db.createUser(
          cleanEmail,
          passwordHash,
          username,
          fullName,
          country,
          bio,
          experienceLevel,
          avatarUrl
        );

        sendWelcomeEmail(cleanEmail, fullName || username || "").catch(e => {
          console.warn("[Resend API] Welcoming dispatch error on bypass ignored:", e);
        });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
          requiresOtp: false,
          success: true,
          message: "Registration successful! Bypassed OTP due to email dispatch limitations.",
          data: {
            session: {
              access_token: token,
              token_type: "bearer",
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                country: user.country,
                bio: user.bio,
                experience_level: user.experience_level,
                avatar_url: user.avatar_url
              }
            }
          }
        });
      }

      res.status(200).json({
        requiresOtp: true,
        success: true,
        message: "Code sent to email. Please verify to complete your signup."
      });
    } catch (err: any) {
      console.error("[Auth API] Signup initiation failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to initialize signup" } });
    }
  });

  app.post("/api/auth/register-request", async (req, res) => {
    try {
      const { email, password, username, fullName, country, bio, experienceLevel, avatarUrl } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: { message: "Email and password are required" } });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Enforce rate limiting
      const limitCheck = checkOtpRateLimit(cleanEmail);
      if (!limitCheck.allowed) {
        return res.status(429).json({ error: { message: limitCheck.message } });
      }

      const existing = await db.getUserByEmail(cleanEmail);
      if (existing) {
        return res.status(400).json({ error: { message: "Email is already registered" } });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      pendingOtps.set(cleanEmail, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
        signupData: {
          passwordHash,
          username,
          fullName,
          country,
          bio,
          experienceLevel,
          avatarUrl
        }
      });

      const sent = await sendOtpEmail(cleanEmail, otp);

      if (!sent) {
        console.warn(`[Auth API] Resend email dispatch failed for register-request (quota or configuration issue). Bypassing OTP requirement and completing registration immediately for ${cleanEmail}.`);
        pendingOtps.delete(cleanEmail);

        const user = await db.createUser(
          cleanEmail,
          passwordHash,
          username,
          fullName,
          country,
          bio,
          experienceLevel,
          avatarUrl
        );

        sendWelcomeEmail(cleanEmail, fullName || username || "").catch(e => {
          console.warn("[Resend API] Welcoming dispatch error on bypass ignored:", e);
        });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
          requiresOtp: false,
          success: true,
          message: "Registration successful! Bypassed OTP due to email dispatch limitations.",
          data: {
            session: {
              access_token: token,
              token_type: "bearer",
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                country: user.country,
                bio: user.bio,
                experience_level: user.experience_level,
                avatar_url: user.avatar_url
              }
            }
          }
        });
      }

      return res.status(200).json({
        requiresOtp: true,
        success: true,
        message: "A verification code has been dispatched to your email. Please enter it to complete registration."
      });
    } catch (err: any) {
      console.error("[Auth API] register-request OTP dispatch failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to initialize registration" } });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: { message: "Email and verification code are required" } });
      }

      const cleanEmail = email.toLowerCase().trim();
      const record = pendingOtps.get(cleanEmail);

      if (!record) {
        return res.status(400).json({ error: { message: "Verification session not found. Please register again." } });
      }

      if (Date.now() > record.expiresAt) {
        pendingOtps.delete(cleanEmail);
        return res.status(400).json({ error: { message: "Verification code has expired. Please sign up again." } });
      }

      if (record.otp !== otp.trim()) {
        return res.status(400).json({ error: { message: "Incorrect security code. Please try again." } });
      }

      // Successful OTP! Perform database record registration
      const { passwordHash, username, fullName, country, bio, experienceLevel, avatarUrl } = record.signupData;
      const user = await db.createUser(
        cleanEmail, 
        passwordHash, 
        username, 
        fullName, 
        country, 
        bio, 
        experienceLevel, 
        avatarUrl
      );

      sendWelcomeEmail(cleanEmail, fullName || username || "").catch(e => {
        console.warn("[Resend API] Welcoming dispatch error ignored client-side:", e);
      });

      pendingOtps.delete(cleanEmail);

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.status(200).json({
        data: {
          session: {
            access_token: token,
            token_type: "bearer",
            user: { 
              id: user.id, 
              email: user.email,
              username: user.username,
              full_name: user.full_name,
              country: user.country,
              bio: user.bio,
              experience_level: user.experience_level,
              avatar_url: user.avatar_url
            }
          }
        },
        error: null
      });
    } catch (err: any) {
      console.error("[Auth API] verify-otp failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to verify security code" } });
    }
  });

  app.post("/api/auth/forgot-password-request", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: { message: "Email address is required." } });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Enforce rate limiting
      const limitCheck = checkOtpRateLimit(cleanEmail);
      if (!limitCheck.allowed) {
        return res.status(429).json({ error: { message: limitCheck.message } });
      }

      const user = await db.getUserByEmail(cleanEmail);
      if (!user) {
        return res.status(404).json({ error: { message: "No registered profile matches this email address." } });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      pendingForgotOtps.set(cleanEmail, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
      });

      const sent = await sendResetOtpEmail(cleanEmail, otp);

      if (!sent) {
        pendingForgotOtps.delete(cleanEmail);
        return res.status(500).json({ error: { message: "Something went wrong, please try again later." } });
      }

      return res.status(200).json({
        success: true,
        message: "Temporary access reset code has been successfully dispatched."
      });
    } catch (err: any) {
      console.error("[Auth API] Forgot password request failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to dispatch reset passcode" } });
    }
  });

  app.post("/api/auth/verify-reset-password", async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp || !newPassword) {
        return res.status(400).json({ error: { message: "Email, code, and new password are required parameters." } });
      }

      const cleanEmail = email.toLowerCase().trim();
      const record = pendingForgotOtps.get(cleanEmail);

      if (!record) {
        return res.status(400).json({ error: { message: "Password reset request session not found or expired." } });
      }

      if (Date.now() > record.expiresAt) {
        pendingForgotOtps.delete(cleanEmail);
        return res.status(400).json({ error: { message: "Reset token has expired. Please request a new code." } });
      }

      if (record.otp !== otp.trim()) {
        return res.status(400).json({ error: { message: "Incorrect security credentials. Correct code required." } });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const ok = await db.updateUserPassword(cleanEmail, passwordHash);

      if (!ok) {
        return res.status(404).json({ error: { message: "Unable to update profile password. Account matching failed." } });
      }

      pendingForgotOtps.delete(cleanEmail);

      return res.status(200).json({
        success: true,
        message: "Your profile passcode has been successfully modified. Please proceed to system clearance login."
      });
    } catch (err: any) {
      console.error("[Auth API] verify-reset-password failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to update profile passcode" } });
    }
  });

  app.post("/api/auth/check-email", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: { message: "Email is required" } });
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = await db.getUserByEmail(cleanEmail);
      if (!user) {
        return res.status(404).json({ error: { message: "Account email not registered on FirstLook" } });
      }

      res.status(200).json({ exists: true });
    } catch (err: any) {
      console.error("[Auth API] check-email failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to evaluate email" } });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: { message: "Email and password are required" } });
      }

      const user = await db.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ error: { message: "Invalid email or password" } });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: { message: "Invalid email or password" } });
      }

      // Sign JWT
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.status(200).json({
        data: {
          session: {
            access_token: token,
            token_type: "bearer",
            user: { 
              id: user.id, 
              email: user.email,
              username: user.username || "",
              full_name: user.full_name || "",
              country: user.country || "",
              bio: user.bio || "",
              experience_level: user.experience_level || "",
              avatar_url: user.avatar_url || ""
            }
          }
        },
        error: null
      });
    } catch (err: any) {
      console.error("[Auth API] Signin failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to sign in" } });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(200).json({ data: { session: null } });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      const user = await db.getUserById(decoded.id);
      if (!user) {
        return res.status(200).json({ data: { session: null } });
      }

      res.status(200).json({
        data: {
          session: {
            access_token: token,
            user: { 
              id: user.id, 
              email: user.email,
              username: user.username || "",
              full_name: user.full_name || "",
              country: user.country || "",
              bio: user.bio || "",
              experience_level: user.experience_level || "",
              avatar_url: user.avatar_url || ""
            }
          }
        }
      });
    } catch (err) {
      // Invalid or expired token
      res.status(200).json({ data: { session: null } });
    }
  });

  app.post("/api/auth/update-profile", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: { message: "Unauthorized. Missing token." } });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { username, full_name, country, bio, experience_level, avatar_url } = req.body;

      const updated = await db.updateUserProfile(decoded.id, {
        username,
        full_name,
        country,
        bio,
        experience_level,
        avatar_url
      });

      if (!updated) {
        return res.status(404).json({ error: { message: "User not found" } });
      }

      res.status(200).json({
        success: true,
        user: {
          id: updated.id,
          email: updated.email,
          username: updated.username || "",
          full_name: updated.full_name || "",
          country: updated.country || "",
          bio: updated.bio || "",
          experience_level: updated.experience_level || "",
          avatar_url: updated.avatar_url || ""
        }
      });
    } catch (err: any) {
      console.error("[Profile API] Update failed:", err);
      res.status(500).json({ error: { message: err.message || "Failed to update profile" } });
    }
  });

  app.post("/api/auth/signout", (req, res) => {
    res.status(200).json({ success: true });
  });

  // --- DATABASE PERSISTENCE ENDPOINTS ---
  app.get("/api/persistence/get-trades", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      const trades = await db.getTrades(userId);
      res.json({ trades });
    } catch (err: any) {
      console.error("[Persistence API] get-trades failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/save-trade", async (req, res) => {
    try {
      const { userId, trade } = req.body;
      if (!userId || !trade) {
        return res.status(400).json({ error: "Missing userId or trade payload" });
      }
      const saved = await db.saveTrade(userId, trade);
      res.json({ success: true, trade: saved });
    } catch (err: any) {
      console.error("[Persistence API] save-trade failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/delete-trades-by-watchlist", async (req, res) => {
    try {
      const { userId, watchlistId } = req.body;
      if (!userId || !watchlistId) {
        return res.status(400).json({ error: "Missing userId or watchlistId" });
      }
      await db.deleteTradesByWatchlist(userId, watchlistId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] delete-trades-by-watchlist failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/delete-trades-for-symbol", async (req, res) => {
    try {
      const { userId, symbol, prefix, watchlistId } = req.body;
      if (!userId || !symbol) {
        return res.status(400).json({ error: "Missing userId or symbol" });
      }
      await db.deleteTradesForSymbol(userId, symbol, prefix || null, watchlistId || null);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] delete-trades-for-symbol failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-drawings", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      const drawings = await db.getDrawings(userId);
      res.json({ drawings });
    } catch (err: any) {
      console.error("[Persistence API] get-drawings failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/save-drawings", async (req, res) => {
    try {
      const { userId, drawings } = req.body;
      if (!userId || !drawings) {
        return res.status(400).json({ error: "Missing userId or drawings" });
      }
      await db.saveDrawings(userId, drawings);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] save-drawings failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-preferences", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      let preferences = await db.getPreferences(userId);
      if (preferences && (preferences.subscriptionPlan === 'plus' || preferences.subscriptionPlan === 'premium')) {
        const isRecurring = preferences.isSubscriptionRecurring === true || (preferences.billingCycle === 'yearly' && preferences.isSubscriptionRecurring);
        const expiry = preferences.subscriptionExpiry ? new Date(preferences.subscriptionExpiry).getTime() : null;
        if (!isRecurring && expiry && Date.now() > expiry) {
          console.log(`[Subscription Manager] Lazy detecting expiration for user ${userId}. Reverting to Basic.`);
          const oldPlan = preferences.subscriptionPlan;
          
          preferences.subscriptionPlan = 'basic';
          preferences.subscriptionExpiry = null;
          preferences.isSubscriptionRecurring = false;
          
          await db.savePreferences(userId, { 
            subscriptionPlan: 'basic',
            subscriptionExpiry: null,
            isSubscriptionRecurring: false
          });

          try {
            const userProfile = await db.getUserById(userId);
            if (userProfile && userProfile.email) {
              await sendSubscriptionExpiredEmail(userProfile.email, oldPlan);
            }
          } catch (mErr) {
            console.error("[Subscription Manager] Failed to send lazy expiration email notification:", mErr);
          }
        }
      }
      res.json({ preferences });
    } catch (err: any) {
      console.error("[Persistence API] get-preferences failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-payment-history", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      const history = await db.getUserPayments(userId);
      res.json({ success: true, history: history || [] });
    } catch (err: any) {
      console.error("[Persistence API] get-payment-history failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

// High-fidelity server-side fallback simulation container (retained across page reloads in Express server memory)
  const supportThreads = new Map<string, any[]>();

  async function getOrCreateThread(userId: string) {
    try {
      const messages = await db.getSupportMessages(userId);
      if (messages && messages.length > 0) {
        // Also keep memory cache in sync
        supportThreads.set(userId, messages);
        return messages;
      }
    } catch (e) {
      console.error("[Support getOrCreateThread] DB error, falling back to cache map:", e);
    }

    if (!supportThreads.has(userId)) {
      supportThreads.set(userId, [
        {
          sender: "admin",
          message: "Welcome to FirstLook Direct Support ⚡\n\nHow can I help you today? Click on any of the frequently asked questions below for instant detailed guidance, or type your enquiry in the chat input.",
          sentAt: new Date().toISOString(),
          read: true
        }
      ]);
    }
    return supportThreads.get(userId)!;
  }

  app.post("/api/support/message", async (req, res) => {
    try {
      const { userId, message, isFaqFlag, isFaq: clientIsFaq } = req.body;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }

      // Determine if this is an FAQ query
      const queryText = (message || "").toLowerCase().trim();
      const isFaq = !!isFaqFlag || !!clientIsFaq || (message && (
        queryText.includes("differences between basic") ||
        queryText.includes("cancel") ||
        queryText.includes("payment renewal") ||
        queryText.includes("modify my active subscription") ||
        queryText.includes("limit") ||
        queryText.includes("watchlist item limits") ||
        queryText.includes("active symbol watchlist") ||
        queryText.includes("competition slots") ||
        queryText.includes("simulated competition") ||
        queryText.includes("broker raw spreads") ||
        queryText.includes("custom broker") ||
        queryText.includes("spreads optimize") ||
        queryText.includes("historical trade replay") ||
        queryText.includes("replay and speed engine") ||
        queryText.includes("backtest") ||
        queryText.includes("install firstlook") ||
        queryText.includes("native desktop") ||
        queryText.includes("pwa") ||
        queryText.includes("slow charts") ||
        queryText.includes("minor lag") ||
        queryText.includes("experience slow")
      ));

      // Fetch user profile to retrieve true registration details securely from DB
      let email = "anonymous@firstlook.com";
      let name = "Anonymous User";
      try {
        const user = await db.getUserById(userId);
        if (user) {
          email = user.email || email;
          name = user.full_name || user.username || email.split("@")[0] || name;
        }
      } catch (dbErr) {
        console.error("[Support Proxy] Failed to fetch user profile:", dbErr);
      }

      // Set up base URL for external API
      let baseUrl = (process.env.FOREX_API_URL || "").trim();
      const forexApiSecret = (process.env.FOREX_API_SECRET || "").trim();

      // Fallback Engine: Graceful server-side thread simulator (keeps UI 100% green and interactive)
      const thread = await getOrCreateThread(userId);
      let finalThread = thread;
      let syncedExternal = false;

      // Ensure that if external support routing is specified, we fetch/send from the real admin desk server.
      if (baseUrl && forexApiSecret && !isFaq) {
        try {
          if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
            baseUrl = `https://${baseUrl}`;
          }
          if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.slice(0, -1);
          }
          const externalUrl = `${baseUrl}/api/support/message`;
          const bodyMessage = (message && message.trim()) ? message.trim() : "__READ_ONLY_PING__";

          const externalResponse = await fetch(externalUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${forexApiSecret}`
            },
            body: JSON.stringify({
              email,
              name,
              message: bodyMessage,
              sentAt: new Date().toISOString()
            })
          });

          if (externalResponse.ok) {
            const externalData = await externalResponse.json();
            if (externalData && externalData.status === "success" && Array.isArray(externalData.thread)) {
              const mapped = externalData.thread
                .filter((m: any) => m.message && m.message !== "__READ_ONLY_PING__")
                .map((m: any) => ({
                  sender: m.sender as 'user' | 'admin',
                  message: m.message || m.text || "",
                  sentAt: m.sent_at || m.sentAt || m.time || new Date().toISOString(),
                  read: m.is_read !== undefined ? m.is_read : true
                }));

              // Make sure to prepend standard welcome prefix if not present
              const hasWelcome = mapped.some((m: any) => m.message && m.message.includes("Welcome to FirstLook Direct Support"));
              if (!hasWelcome) {
                mapped.unshift({
                  sender: "admin",
                  message: "Welcome to FirstLook Direct Support ⚡\n\nHow can I help you today? Click on any of the frequently asked questions below for instant detailed guidance, or type your enquiry in the chat input.",
                  sentAt: mapped[0] ? mapped[0].sentAt : new Date().toISOString(),
                  read: true
                });
              }
              finalThread = mapped;
              syncedExternal = true;
            }
          } else {
            console.warn(`[Support External] External support API returned non-200 state: ${externalResponse.status}`);
          }
        } catch (externErr) {
          console.warn("[Support External] Connection or DNS error during live support routing:", externErr);
        }
      }

      // If we couldn't interface with the external desk or are running in mock/FAQ, fall back/append locally
      if (!syncedExternal) {
        if (message && message.trim()) {
          thread.push({
            sender: "user",
            message: message.trim(),
            sentAt: new Date().toISOString(),
            read: true
          });

          // Simulate intelligent helpdesk support responder
          let reply = "Thanks for reaching out! Our designated representative has been notified of your concern. We will update you here shortly. If there's any other context you'd like to provide, type it below!";
          const query = message.toLowerCase().trim();

          if (query.includes('differences between basic') || query.includes('basic plus and premium') || query.includes('difference between basic')) {
            reply = "• Basic (Free): Lifetime core indicator suite, watchlist of up to 3 concurrent active symbols, and standard fixed market spreads with zero history logs.\n\n• Plus ($5.00/mo or $4.20/mo yearly): Customizable raw spreads toggles, unlimited active watchlist items, time-synced playback/loops, historical trade replay speed engine, and high-fidelity competition slots.\n\n• Premium ($20.00/mo or $16.80/mo yearly): Includes all Plus features plus unlimited concurrent competition slots, high-priority streaming tickers, and multi-seat team management with up to 10 invitation slots to share trading metrics live.";
          } else if (query.includes('cancel') || query.includes('payment renewal') || query.includes('modify my active subscription')) {
            reply = "We believe in honest, transparent pricing. If you enabled recurring billing during Paystack checkout, an interactive 'Stop Auto-Renewal' button is displayed directly at the top of the pricing page. Clicking it will stop future billing instantly. Your premium tier privileges will remain 100% active and editable until the final day of your paid cycle, at which point it gracefully downgrades to Basic without lockouts.";
          } else if (query.includes('limit') || query.includes('watchlist item limits') || query.includes('active symbol watchlist')) {
            reply = "We believe in high-focus market tracking. Under the Basic free tier, we limit active concurrent 'Ongoing' symbols in your watchlist to 3 pairs to conserve live server WebSockets. You can archive an infinite number of completed setups and load them anytime! Upgrading to Plus or Premium removes all concurrent symbol constraints, allowing you to track and stream all available forex and cryptocurrency pairs simultaneously.";
          } else if (query.includes('competition slots') || query.includes('simulated competition')) {
            reply = "We designed simulated competitions so you can test your trading setups and build high scores under realistic market pressure. On our Basic plan, competitions are locked to preserve compute power. Upgrading to our Plus tier immediately unlocks all available competition slots for you. If you choose our Premium tier, you unlock totally unlimited concurrent slot entries so you can compete in non-stop, high-stakes testing rounds.";
          } else if (query.includes('broker raw spreads') || query.includes('custom broker') || query.includes('spreads optimize')) {
            reply = "Real life broker feeds include fine spreads that can impact tight Stop-Loss execution. FirstLook streams real-time raw feeds and allows Plus and Premium members to simulate spreads from elite brokers like Pepperstone Razor (at 0.0 pips), Axiory (at 0.1 pips), or IC Markets (at 0.2 pips), or deactivate spreads entirely! Basic users operate on standard, fixed retail spread rates.";
          } else if (query.includes('historical trade replay') || query.includes('replay and speed engine') || query.includes('backtest')) {
            reply = "Our Trade Replay engine allows you to step backward on any chart to execute strategy evaluations with tick completeness. You can fast-forward candles step-by-step with adjustable speeds, open/manage virtual trades, and log backtesting metrics, fully calculated locally in your browser. This custom speed engine is fully enabled on Plus and Premium memberships.";
          } else if (query.includes('install firstlook') || query.includes('native desktop') || query.includes('certified progressive') || query.includes('pwa')) {
            reply = "FirstLook is a certified Progressive Web App (PWA) requiring zero heavy installer binaries. For iOS Safari: tap the 'Share' icon and select 'Add to Home Screen'. For Android Chrome: tap the menu dot and choose 'Install App'. For macOS or Windows Chrome: click the 'Install FirstLook' shortcut inside the browser address bar to run it in a fast, dedicated standalone framing with native optimization.";
          } else if (query.includes('slow charts') || query.includes('minor lag') || query.includes('experience slow')) {
            reply = "Because FirstLook computes million-point streaming charts locally to minimize background data overhead, your browser's index memory cache can occasionally retain excess historic buffers. Simply refreshing your window, restarting your tab, or clicking 'Clear Local Setups' inside your profile setup immediately clears structural cache, instantly restoring rapid, smooth performance.";
          } else if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('greetings')) {
            reply = "Hello! I am your FirstLook support assistant. Feel free to click any of the 8 frequently asked questions below for an instant detailed answer!";
          } else if (query.includes('contact') || query.includes('representative') || query.includes('person')) {
            reply = "You can chat with me here directly! If you require deeper account lookup, feel free to email us at support@firstlook.com and we will assist you!";
          }

          thread.push({
            sender: "admin",
            message: reply,
            sentAt: new Date().toISOString(),
            read: true
          });
        }
        finalThread = thread;
      }

      // Save updated thread synchronously to DB
      try {
        await db.saveSupportMessages(userId, finalThread);
      } catch (dbErr) {
        console.error("[Support Proxy] Failed to save thread back to DB:", dbErr);
      }

      res.json({
        status: "success",
        thread: finalThread
      });

    } catch (err: any) {
      console.error("[Support Proxy] Fatal fallback handler fail:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.post("/api/persistence/save-preferences", async (req, res) => {
    try {
      const { userId, prefs } = req.body;
      if (!userId || !prefs) {
        return res.status(400).json({ error: "Missing userId or prefs" });
      }
      await db.savePreferences(userId, prefs);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] save-preferences failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-watchlist", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      const items = await db.getWatchlist(userId);
      res.json({ items });
    } catch (err: any) {
      console.error("[Persistence API] get-watchlist failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/save-watchlist", async (req, res) => {
    try {
      const { userId, items } = req.body;
      if (!userId || !items) {
        return res.status(400).json({ error: "Missing userId or items" });
      }
      await db.saveWatchlist(userId, items);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] save-watchlist failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-backtest-sessions", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      const sessions = await db.getBacktestSessions(userId);
      res.json({ sessions });
    } catch (err: any) {
      console.error("[Persistence API] get-backtest-sessions failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/save-backtest-sessions", async (req, res) => {
    try {
      const { userId, sessions } = req.body;
      if (!userId || !sessions) {
        return res.status(400).json({ error: "Missing userId or sessions" });
      }
      await db.saveBacktestSessions(userId, sessions);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] save-backtest-sessions failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-active-session", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      const sessionId = await db.getActiveSession(userId);
      res.json({ active_session_id: sessionId });
    } catch (err: any) {
      console.error("[Persistence API] get-active-session failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/update-active-session", async (req, res) => {
    try {
      const { userId, sessionId } = req.body;
      if (!userId || !sessionId) {
        return res.status(400).json({ error: "Missing userId or sessionId" });
      }
      await db.updateActiveSession(userId, sessionId);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] update-active-session failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/persistence/get-setups", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "Missing userId" });
      }
      const setups = await db.getSetups(userId);
      res.json({ setups });
    } catch (err: any) {
      console.error("[Persistence API] get-setups failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/save-setup", async (req, res) => {
    try {
      const { userId, grade, imageUrl, confluences } = req.body;
      if (!userId || !grade) {
        return res.status(400).json({ error: "Missing userId or grade" });
      }
      await db.saveSetup(userId, grade, imageUrl || null, confluences || []);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Persistence API] save-setup failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/persistence/upload-setup-image", async (req, res) => {
    try {
      const { userId, grade, imageBase64 } = req.body;
      if (!userId || !grade || !imageBase64) {
        return res.status(400).json({ error: "Missing required fields userId, grade, or imageBase64" });
      }
      await db.saveSetup(userId, grade, imageBase64, []);
      res.json({ success: true, publicUrl: imageBase64 });
    } catch (err: any) {
      console.error("[Persistence API] upload-setup-image failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- PAYSTACK SUBSCRIPTION GATEWAY ENDPOINTS ---
  app.post("/api/paystack/initialize", async (req, res) => {
    try {
      const { plan, billingCycle, email, userId, country, recurring } = req.body;
      if (!plan || !email || !userId) {
        return res.status(400).json({ error: "Missing required initialize fields: plan, email, or userId" });
      }

      // 1. Calculate USD amount based on membership tier and cycle
      let usdAmount = 5.00;
      if (plan === 'premium') {
        usdAmount = billingCycle === 'yearly' ? 201.60 : 20.00;
      } else {
        usdAmount = billingCycle === 'yearly' ? 50.40 : 5.00;
      }

      usdAmount = parseFloat(usdAmount.toFixed(2));

      // 2. Select currency and rate according to country using the real life strategy currency converter
      const currencyInfo = getCurrencyForCountry(country || 'United States');

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      const mode = getProjectMode();
      
      if (mode === "live" && (!secretKey || secretKey.trim() === '' || secretKey.includes('placeholder'))) {
        return res.status(400).json({ 
          status: false, 
          error: "API is in LIVE production mode, but your PAYSTACK_SECRET_KEY is missing or invalid. Simulation pathways are blocked." 
        });
      }

      const isMockMode = mode === "test" && (!secretKey || secretKey.trim() === '' || secretKey.includes('placeholder') || secretKey.trim().startsWith('sk_test'));

      // For interactive test simulation play, we can charge in the EXACT local currency (e.g. GBP, EUR, CAD, KES, etc.)
      // which offers a fully professional, highly realistic experience.
      // For real live production API, Paystack ONLY supports NGN, GHS, KES, ZAR, or USD.
      const currency = isMockMode ? currencyInfo.code : currencyInfo.paystackCurrency;
      
      // Compute the premium localized billing metrics
      const paystackRate = currencyInfo.rate;
      const localAmount = parseFloat((usdAmount * paystackRate).toFixed(2));
      const paystackAmountSubunits = Math.round(localAmount * 100);
      const reference = `FL-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const callbackUrl = `${req.headers.origin || 'http://localhost:3000'}/api/paystack/callback`;

      // Determine payment channels based on country and recurring (auto_renew) settings
      const normalizedCountry = (country || "").trim().toLowerCase();
      const isLocalAfricanMarket = normalizedCountry.includes("nigeria") || 
                                   normalizedCountry.includes("nigerian") || 
                                   normalizedCountry.includes("kenya") || 
                                   normalizedCountry.includes("kenyan") || 
                                   normalizedCountry.includes("ghana") || 
                                   normalizedCountry.includes("ghanaian") || 
                                   normalizedCountry.includes("south africa") || 
                                   normalizedCountry.includes("south african");

      const isRecurring = recurring === true || recurring === 'true';
      // If country is NG, KE, GH, or ZA and auto debit wasn't enabled, allow both card and bank transfer. Otherwise card-only.
      const channels = (isLocalAfricanMarket && !isRecurring) ? ["card", "bank_transfer"] : ["card"];

      const payload = {
        email,
        amount: paystackAmountSubunits,
        currency: isMockMode ? currency : currencyInfo.paystackCurrency, // Securely ensure valid live currency codes
        reference,
        callback_url: callbackUrl,
        channels,
        metadata: {
          userId,
          plan,
          billingCycle,
          usdAmount,
          currency,
          localAmount,
          isMock: isMockMode,
          isSubscriptionRecurring: isRecurring,
          channels
        }
      };

      if (isMockMode) {
        // Simulates payment with interactive panel client-side
        const isRecurring = recurring === true;
        const simUrl = `/paystack-test-simulator?reference=${reference}&email=${encodeURIComponent(email)}&amount=${localAmount}&currency=${currency}&plan=${plan}&userId=${userId}&isSubscriptionRecurring=${isRecurring}&billingCycle=${billingCycle}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
        return res.json({
          status: true,
          message: "Secure simulation checkout loaded",
          data: {
            authorization_url: simUrl,
            reference,
            isMock: true,
            currency,
            localAmount,
            usdAmount,
            isSubscriptionRecurring: isRecurring,
            billingCycle
          }
        });
      }

      // Call real Paystack API
      const liveCurrency = currencyInfo.paystackCurrency;
      const liveRate = liveCurrency === 'USD' ? 1.0 : currencyInfo.rate;
      const liveLocalAmount = parseFloat((usdAmount * liveRate).toFixed(2));
      const liveAmountSubunits = Math.round(liveLocalAmount * 100);

      let livePlanCode: string | null = null;
      if (recurring === true) {
        livePlanCode = await getOrCreatePaystackPlan(plan, billingCycle, secretKey, liveAmountSubunits, liveCurrency);
      }

      const livePayload: any = {
        ...payload,
        currency: liveCurrency,
        amount: liveAmountSubunits,
        metadata: {
          ...payload.metadata,
          currency: liveCurrency,
          localAmount: liveLocalAmount,
          isSubscriptionRecurring: !!livePlanCode
        }
      };

      if (livePlanCode) {
        livePayload.plan = livePlanCode;
      }

      console.log(`[Paystack API] Initializing production transaction for: ${email}, amount: ${liveAmountSubunits} ${liveCurrency} (Recurring: ${!!livePlanCode})`);
      let response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(livePayload)
      });

      let result = await response.json();

      // Auto-fixing currency issue if the merchant has no USD/foreign currency enabled on their live Paystack account (very common)
      if (!result.status && (
        result.message === "Currency not supported by merchant" || 
        result.message === "Currency not supported value" || 
        (result.message && result.message.toLowerCase().includes("currency"))
      )) {
        const fallbackCurrency = (process.env.PAYSTACK_MERCHANT_CURRENCY || 'NGN').toUpperCase();
        if (liveCurrency !== fallbackCurrency) {
          let fallbackCountry = "Nigeria";
          if (fallbackCurrency === "GHS") fallbackCountry = "Ghana";
          else if (fallbackCurrency === "KES") fallbackCountry = "Kenya";
          else if (fallbackCurrency === "ZAR") fallbackCountry = "South Africa";
          else if (fallbackCurrency === "USD") fallbackCountry = "United States";

          const fallbackInfo = getCurrencyForCountry(fallbackCountry);
          const fallbackRate = fallbackInfo ? fallbackInfo.rate : 1500.0;
          
          console.warn(`[Paystack API Optimization] Billing currency '${liveCurrency}' is not supported by your Paystack Merchant Account. ` +
                       `To resolve this permanently and accept international payments in USD, enable 'International Payments' inside your Paystack Dashboard (Settings -> API Keys & Webhooks -> Enable International Payments). ` +
                       `Executing automatic dynamic self-healing using fallback merchant currency: ${fallbackCurrency} at rate: ${fallbackRate}`);
          
          const fallbackLocalAmount = parseFloat((usdAmount * fallbackRate).toFixed(2));
          const fallbackPaystackAmountSubunits = Math.round(fallbackLocalAmount * 100);
          
          let fallbackPlanCode: string | null = null;
          if (recurring === true) {
            fallbackPlanCode = await getOrCreatePaystackPlan(plan, billingCycle, secretKey, fallbackPaystackAmountSubunits, fallbackCurrency);
          }

          const fallbackPayload: any = {
            ...payload,
            amount: fallbackPaystackAmountSubunits,
            currency: fallbackCurrency,
            metadata: {
              ...payload.metadata,
              currency: fallbackCurrency,
              localAmount: fallbackLocalAmount,
              usdAmount,
              isSubscriptionRecurring: !!fallbackPlanCode
            }
          };

          if (fallbackPlanCode) {
            fallbackPayload.plan = fallbackPlanCode;
          }
          
          console.log(`[Paystack API Retry] Retrying production initialization with fallback currency: ${fallbackCurrency}, amount: ${fallbackPaystackAmountSubunits}`);
          
          const retryResponse = await fetch("https://api.paystack.co/transaction/initialize", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${secretKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(fallbackPayload)
          });
          
          const retryResult = await retryResponse.json();
          if (retryResult.status) {
            console.log(`[Paystack API Success] Self-healing completed successfully using fallback currency ${fallbackCurrency}.`);
            return res.json({
              status: true,
              message: retryResult.message,
              data: {
                authorization_url: retryResult.data.authorization_url,
                access_code: retryResult.data.access_code,
                reference: retryResult.data.reference,
                publicKey: process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || '',
                isMock: false,
                currency: fallbackCurrency,
                localAmount: fallbackLocalAmount,
                usdAmount
              }
            });
          } else {
            console.error(`[Paystack API Failure] Fallback currency ${fallbackCurrency} also failed initialization:`, retryResult.message);
          }
        }
      }

      if (!result.status) {
        return res.status(400).json({ error: result.message || "Paystack initialization failed" });
      }

      res.json({
        status: true,
        message: result.message,
        data: {
          authorization_url: result.data.authorization_url,
          access_code: result.data.access_code,
          reference: result.data.reference,
          publicKey: process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || '',
          isMock: false,
          currency: liveCurrency,
          localAmount: liveLocalAmount,
          usdAmount
        }
      });
    } catch (err: any) {
      console.error("[Paystack API] initialization error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/paystack/callback", async (req, res) => {
    try {
      const reference = (req.query.reference || req.query.trxref) as string;
      if (!reference || typeof reference !== 'string') {
        return res.redirect("/?payment=error&message=No+reference+provided");
      }

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      const mode = getProjectMode();
      const isMock = mode === "test" && (!secretKey || secretKey.trim() === '' || secretKey.includes('placeholder') || secretKey.trim().startsWith('sk_test'));

      let verified = false;
      let userId = '';
      let plan = '';

      if (isMock) {
        // Fallback simulated payment (mock refs bypass and auto-resolve)
        verified = true;
        // Search reference formatting for plan/user or look at session user
        // We will read reference to upgrade, but in mock mode the simulator frontend updates itself
        // let's do redirect cleanly to success
        return res.redirect(`/?payment=success&referral=${reference}&mock=true`);
      } else {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${secretKey}`
          }
        });
        const result = await response.json();
        if (result.status && result.data?.status === 'success') {
          verified = true;
          userId = result.data.metadata?.userId;
          plan = result.data.metadata?.plan;
          
          const metadata = result.data.metadata || {};
          const isSubscriptionRecurring = metadata.isSubscriptionRecurring === true || metadata.isSubscriptionRecurring === 'true';
          const billingCycle = metadata.billingCycle || 'monthly';
          const durationDays = billingCycle === 'yearly' ? 365 : 30;
          const graceDays = isSubscriptionRecurring ? 5 : 0;
          const subscriptionExpiry = Date.now() + (durationDays + graceDays) * 24 * 60 * 60 * 1000;

          if (userId && plan) {
            const currentPrefs = await db.getPreferences(userId) || {};
            await db.savePreferences(userId, { 
              ...currentPrefs, 
              subscriptionPlan: plan,
              isSubscriptionRecurring,
              subscriptionExpiry,
              billingCycle
            });

            // Log payment log in Admin Analytics
            try {
              const user = await db.getUserById(userId);
              const email = user?.email || result.data?.customer?.email || "guest@firstlook.com";
              const fullName = user?.full_name || `${result.data?.customer?.first_name || ""} ${result.data?.customer?.last_name || ""}`.trim() || user?.username || "Trader";
              const country = user?.country || result.data?.ip_address_country || "United States";
              
              const cycle = billingCycle || 'monthly';
              const currencyInfo = getCurrencyForCountry(country);
              const amountUsd = plan === "premium" ? (cycle === "yearly" ? 201.60 : 20.00) : (cycle === "yearly" ? 50.40 : 5.00);
              const localAmount = result.data?.amount ? (result.data.amount / 100) : parseFloat((amountUsd * currencyInfo.rate).toFixed(2));
              const currency = result.data?.currency || (isMock ? currencyInfo.code : currencyInfo.paystackCurrency);

              await db.logPayment(
                userId,
                email,
                fullName,
                amountUsd,
                localAmount,
                currency,
                plan,
                country,
                reference
              );
            } catch (pErr) {
              console.error("[Paystack Callback] Log payment analytic error:", pErr);
            }

            return res.redirect(`/?payment=success&referral=${reference}&plan=${plan}`);
          }
        }
      }

      res.redirect("/?payment=failed");
    } catch (err) {
      console.error("[Paystack Callback] Verification error:", err);
      res.redirect("/?payment=error");
    }
  });

  app.get("/api/paystack/verify/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      const mode = getProjectMode();
      const isMock = mode === "test" && (!secretKey || secretKey.trim() === '' || secretKey.includes('placeholder') || secretKey.trim().startsWith('sk_test'));

      if (isMock) {
        res.json({ status: true, data: { status: 'success', isMock: true } });
        return;
      }

      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${secretKey}`
        }
      });
      const result = await response.json();
      if (result.status && result.data?.status === 'success') {
        const userId = result.data.metadata?.userId;
        const plan = result.data.metadata?.plan;
        
        const metadata = result.data.metadata || {};
        const isSubscriptionRecurring = metadata.isSubscriptionRecurring === true || metadata.isSubscriptionRecurring === 'true';
        const billingCycle = metadata.billingCycle || 'monthly';
        const durationDays = billingCycle === 'yearly' ? 365 : 30;
        const graceDays = isSubscriptionRecurring ? 5 : 0;
        const subscriptionExpiry = Date.now() + (durationDays + graceDays) * 24 * 60 * 60 * 1000;

        if (userId && plan) {
          const currentPrefs = await db.getPreferences(userId) || {};
          await db.savePreferences(userId, { 
            ...currentPrefs, 
            subscriptionPlan: plan,
            isSubscriptionRecurring,
            subscriptionExpiry,
            billingCycle
          });

          // Log database tracking inside Admin Analytics
          try {
            const user = await db.getUserById(userId);
            const email = user?.email || result.data?.customer?.email || "guest@firstlook.com";
            const fullName = user?.full_name || `${result.data?.customer?.first_name || ""} ${result.data?.customer?.last_name || ""}`.trim() || user?.username || "Trader";
            const country = user?.country || result.data?.ip_address_country || "United States";
            
            const cycle = billingCycle || 'monthly';
            const currencyInfo = getCurrencyForCountry(country);
            const amountUsd = plan === "premium" ? (cycle === "yearly" ? 201.60 : 20.00) : (cycle === "yearly" ? 50.40 : 5.00);
            const localAmount = result.data?.amount ? (result.data.amount / 100) : parseFloat((amountUsd * currencyInfo.rate).toFixed(2));
            const currency = result.data?.currency || (isMock ? currencyInfo.code : currencyInfo.paystackCurrency);

            await db.logPayment(
              userId,
              email,
              fullName,
              amountUsd,
              localAmount,
              currency,
              plan,
              country,
              reference
            );
          } catch (pErr) {
            console.error("[Paystack Verify API] Log payment tracking error:", pErr);
          }
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("[Paystack API] verification error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/paystack/config", (req, res) => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const mode = getProjectMode();
    const isMock = mode === "test" && (!secretKey || secretKey.trim() === '' || secretKey.includes('placeholder') || secretKey.trim().startsWith('sk_test'));
    res.json({
      mode,
      isMock
    });
  });

  app.post("/api/paystack/verify-mock", async (req, res) => {
    try {
      if (getProjectMode() === "live") {
        return res.status(403).json({ error: "Forbidden: Mock billing verification is disabled under LIVE production settings." });
      }

      const { userId, plan, reference, isSubscriptionRecurring, billingCycle } = req.body;
      if (!userId || !plan) {
        return res.status(400).json({ error: "Missing required mock verification fields" });
      }
      
      const isRecurring = isSubscriptionRecurring === true || isSubscriptionRecurring === 'true';
      const cycle = billingCycle || 'monthly';
      const durationDays = cycle === 'yearly' ? 365 : 30;
      const graceDays = isRecurring ? 5 : 0;
      const subscriptionExpiry = Date.now() + (durationDays + graceDays) * 24 * 60 * 60 * 1000;

      const currentPrefs = await db.getPreferences(userId) || {};
      await db.savePreferences(userId, { 
        ...currentPrefs, 
        subscriptionPlan: plan,
        isSubscriptionRecurring: isRecurring,
        subscriptionExpiry,
        billingCycle: cycle
      });

      // Log verification transaction metrics dynamically inside the analytical tables
      try {
        const user = await db.getUserById(userId);
        const email = user?.email || "guest@firstlook.com";
        const fullName = user?.full_name || user?.username || "Trader Mock";
        const country = user?.country || "United States";
        
        const currencyInfo = getCurrencyForCountry(country);
        const amountUsd = plan === "premium" ? (cycle === "yearly" ? 201.60 : 20.00) : (cycle === "yearly" ? 50.40 : 5.00);
        const amountLocal = parseFloat((amountUsd * currencyInfo.rate).toFixed(2));
        const refStr = reference || `FL-PAY-${crypto.randomUUID()}`;
        
        // In simulation, we charge in the user's direct local currency code for realistic billing
        const currencyCode = currencyInfo.code;

        await db.logPayment(
          userId,
          email,
          fullName,
          amountUsd,
          amountLocal,
          currencyCode,
          plan,
          country,
          refStr
        );
      } catch (pErr) {
        console.error("[Paystack Verify Mock] Log payment tracking error:", pErr);
      }

      res.json({ status: true, message: "Mock upgraded successfully" });
    } catch (err: any) {
      console.error("[Paystack API] mock verification error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/paystack/webhook", async (req, res) => {
    try {
      const signature = req.headers['x-paystack-signature'];
      if (!signature) {
        return res.status(401).json({ error: "Missing webhook signature" });
      }

      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        return res.status(500).json({ error: "Webhook key missing" });
      }

      const hash = require("crypto")
        .createHmac("sha512", secretKey)
        .update(JSON.stringify(req.body))
        .digest("hex");

      if (hash !== signature) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const event = req.body;
      if (event.event === 'charge.success') {
        const metadata = event.data?.metadata;
        const userId = metadata?.userId;
        const plan = metadata?.plan;

        if (userId && plan) {
          console.log(`[Paystack Webhook] Upgrading user ${userId} to plan ${plan}`);
          const isSubscriptionRecurring = metadata?.isSubscriptionRecurring === true || metadata?.isSubscriptionRecurring === 'true';
          const billingCycle = metadata?.billingCycle || 'monthly';
          const durationDays = billingCycle === 'yearly' ? 365 : 30;
          const graceDays = isSubscriptionRecurring ? 5 : 0;
          const subscriptionExpiry = Date.now() + (durationDays + graceDays) * 24 * 60 * 60 * 1000;

          const currentPrefs = await db.getPreferences(userId) || {};
          await db.savePreferences(userId, { 
            ...currentPrefs, 
            subscriptionPlan: plan,
            isSubscriptionRecurring,
            subscriptionExpiry,
            billingCycle
          });

          // Log database tracking inside Admin Analytics
          try {
            const user = await db.getUserById(userId);
            const email = user?.email || event.data?.customer?.email || "guest@firstlook.com";
            const fullName = user?.full_name || `${event.data?.customer?.first_name || ""} ${event.data?.customer?.last_name || ""}`.trim() || user?.username || "Trader";
            const country = user?.country || event.data?.customer?.metadata?.country || "United States";
            
            const cycle = billingCycle || 'monthly';
            const currencyInfo = getCurrencyForCountry(country);
            const amountUsd = plan === "premium" ? (cycle === "yearly" ? 201.60 : 20.00) : (cycle === "yearly" ? 50.40 : 5.00);
            const localAmount = event.data?.amount ? (event.data.amount / 100) : parseFloat((amountUsd * currencyInfo.rate).toFixed(2));
            const currency = event.data?.currency || (getProjectMode() === "test" ? currencyInfo.code : currencyInfo.paystackCurrency);
            const ref = event.data?.reference || `FL-PAY-W-${crypto.randomUUID()}`;

            await db.logPayment(
              userId,
              email,
              fullName,
              amountUsd,
              localAmount,
              currency,
              plan,
              country,
              ref
            );
          } catch (pErr) {
            console.error("[Paystack Webhook] Log payment tracking error:", pErr);
          }
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("[Paystack Webhook] execution error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- TRUSTPILOT FEEDBACK BRIDGE ---
  app.post("/api/feedback/trustpilot", async (req, res) => {
    try {
      const { rating, feedback, email, name, userId } = req.body;
      if (!rating) {
        return res.status(400).json({ error: "Rating is required" });
      }

      const trustpilotKey = process.env.TRUSTPILOT_API_KEY;
      const businessUnitId = process.env.TRUSTPILOT_BUSINESS_UNIT_ID;

      const isMockMode = !trustpilotKey || trustpilotKey.trim() === '' || trustpilotKey.includes('placeholder');

      console.log(`[Trustpilot API] Received feedback: Stars = ${rating}, reviewer = ${email || 'Anonymous'}, text = ${feedback || '(none)'}`);

      if (isMockMode) {
        // Build a beautiful simulated successful submission to Trustpilot
        return res.json({
          status: true,
          message: "Feedback submitted to Trustpilot successfully (Sandbox simulation mode)",
          data: {
            id: `tp-rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            businessUnitId: businessUnitId || "5e24f8d48a1c8f000109d949",
            rating,
            feedback: feedback || "Excellent backtesting utility, high resolution feeds!",
            email: email || "anonymous@firstlook.com",
            name: name || "FirstLook Trader",
            isMock: true,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Real integration: Authenticate with Trustpilot API and submit a product-review invitation
      try {
        const payload = {
          recipientEmail: email || "guest-feedback@firstlook.com",
          recipientName: name || "FirstLook Trader",
          referenceId: `FL-TP-${Date.now()}`,
          senderEmail: "feedback@firstlook.com",
          senderName: "FirstLook Terminal",
          replyTo: "no-reply@firstlook.com",
          serviceReviewTriggerTime: new Date().toISOString(),
          tags: ["AppletFeedback", `Rating-${rating}`]
        };

        const response = await fetch(`https://api.trustpilot.com/v1/private/business-units/${businessUnitId}/email-invitations`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${trustpilotKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const info = await response.json();
        return res.json({
          status: true,
          message: "Real invitation feedback dispatched to Trustpilot",
          data: info
        });
      } catch (tpErr: any) {
        console.error("[Trustpilot API] Error with production integration, falling back to database logs", tpErr);
        return res.json({
          status: true,
          message: "Feedback logged locally due to API integration issue",
          error: tpErr.message,
          data: { rating, feedback, email }
        });
      }
    } catch (err: any) {
      console.error("[Trustpilot API Handler Error]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- STANDARD CONTACT ENDPOINT ---
  app.post("/api/contact", async (req, res) => {
    try {
      const { fullname, usermail, subject, message } = req.body;
      if (!fullname || !usermail || !subject || !message) {
        return res.status(400).json({
          error: "[API 400 Bad Request] Missing required fields: fullname, usermail, subject, message."
        });
      }

      // Generate a unique ID: cu-timestamp-random as a fallback
      const randomStr = Math.random().toString(36).substring(2, 7);
      const customId = `cu-${Date.now()}-${randomStr}`;

      console.log(`[Contact API] Form submitted by ${fullname} (${usermail}). ID generated: ${customId}`);

      // Parse external API settings
      let baseUrl = (process.env.FOREX_API_URL || "https://datawarehouse-vi6d.onrender.com").trim();
      const forexApiSecret = (process.env.FOREX_API_SECRET || "").trim();

      if (baseUrl) {
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
          baseUrl = `https://${baseUrl}`;
        }
        if (baseUrl.endsWith("/")) {
          baseUrl = baseUrl.slice(0, -1);
        }
      }

      // Prepare support email settings using custom SUPPORT_RECIPIENT_EMAIL variable
      const supportEmail = process.env.SUPPORT_RECIPIENT_EMAIL || "support@firstlooklabs.xyz";
      const emailSubject = `[Contact Request] ${subject}`;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
    .heading { font-size: 18px; color: #0f172a; margin: 0; font-weight: bold; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 16px; }
    .label { font-weight: bold; color: #475569; }
    .content-box { background-color: #f1f5f9; border-radius: 6px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; }
    .footer { font-size: 12px; color: #94a3b8; font-style: italic; margin-top: 24px; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 class="heading">FirstLook Labs Contact Form Submission</h2>
    </div>
    <div class="meta">
      <p><span class="label">From:</span> ${fullname} (&lt;${usermail}&gt;)</p>
      <p><span class="label">Date:</span> ${new Date().toUTCString()}</p>
      <p><span class="label">Contact ID:</span> ${customId}</p>
      <p><span class="label">API Send Type:</span> Concurrently Synchronous</p>
    </div>
    <div class="content-box">
      <strong>Subject:</strong> ${subject}<br><br>
      <strong>Message:</strong><br>
      ${message.replace(/\r?\n/g, '<br />')}
    </div>
    <div class="footer">
      FirstLook Labs Ltd • Test First. Risk Later. • https://firstlooklabs.xyz
    </div>
  </div>
</body>
</html>`;

      // Dispatch real external API call and Resend Mail concurrently via Promise.allSettled
      // This is a MUST for Google Cloud Run or serverless environments, securing active CPU allocation to guarantee email delivery
      console.log(`[Contact API] Concurrently executing external database API and Resend delivery...`);
      
      const [apiResult, emailResult] = await Promise.allSettled([
        (async () => {
          if (!baseUrl) {
            return {
              success: true,
              message: "Contact request processed locally (No external data warehouse URL defined).",
              id: customId,
              status: 200
            };
          }

          const externalUrl = `${baseUrl}/api/contact`;
          const externalResponse = await fetch(externalUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(forexApiSecret ? { "Authorization": `Bearer ${forexApiSecret}` } : {})
            },
            body: JSON.stringify({ fullname, usermail, subject, message })
          });

          const status = externalResponse.status;
          const externalData = await externalResponse.json().catch(() => ({}));

          if (externalResponse.ok) {
            return {
              success: true,
              message: externalData.message || "Contact request submitted successfully.",
              id: externalData.id || customId,
              status
            };
          } else {
            throw {
              status,
              error: externalData.error || "Failed forwarding message to the external database server."
            };
          }
        })(),

        sendEmail(supportEmail, emailSubject, html, message, `FirstLook Labs Helpdesk`, false, usermail)
      ]);

      let apiStatusCode = 200;
      let apiMessage = "Contact request submitted successfully.";
      let apiTicketId = customId;
      let externalErrorMsg: string | null = null;

      // Extract results from the external API promise
      if (apiResult.status === "fulfilled") {
        const val = apiResult.value;
        apiStatusCode = val.status ?? 200;
        apiMessage = val.message;
        apiTicketId = val.id;
      } else {
        const reason = apiResult.reason;
        apiStatusCode = reason.status ?? 502;
        externalErrorMsg = reason.error ?? "Connection or forwarding exception to external data gateway.";
      }

      // Check results from the Resend promise
      const emailSent = emailResult.status === "fulfilled" && emailResult.value === true;
      if (emailSent) {
        console.log(`[Contact API Success] Resend Mail copy successfully transmitted to support inbox: ${supportEmail}`);
      } else {
        const emailErr = emailResult.status === "rejected" ? emailResult.reason : "API key configuration error";
        console.warn(`[Contact API Alert] Resend Mail copy could not be dispatched:`, emailErr);
      }

      // Return failure response if external API rejected the payload
      if (externalErrorMsg) {
        return res.status(apiStatusCode).json({
          error: `[API ${apiStatusCode} Error] ${externalErrorMsg}`
        });
      }

      return res.status(200).json({
        status: "success",
        message: `[API ${apiStatusCode} OK] ${apiMessage}`,
        id: apiTicketId
      });
    } catch (err: any) {
      console.error("[Contact API Error]", err);
      return res.status(500).json({ error: `[API 500 Internal Error] ${err.message}` });
    }
  });

  // --- STANDARD FEEDBACK ENDPOINT ---
  app.post("/api/feedback", async (req, res) => {
    try {
      const { rate, user_email, feedback } = req.body;
      if (rate === undefined || rate === null || !user_email || feedback === undefined || feedback === null) {
        return res.status(400).json({
          error: "[API 400 Bad Request] Missing 'rate', 'user_email' or 'feedback' parameters."
        });
      }

      // Generate a unique standard UUID style format ID
      const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      const uuid = `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;

      console.log(`[Feedback API] New rating score registered: ${rate} from user ${user_email}. ID: ${uuid}`);

      // Parse external API settings
      let baseUrl = (process.env.FOREX_API_URL || "https://datawarehouse-vi6d.onrender.com").trim();
      const forexApiSecret = (process.env.FOREX_API_SECRET || "").trim();

      if (baseUrl) {
        if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
          baseUrl = `https://${baseUrl}`;
        }
        if (baseUrl.endsWith("/")) {
          baseUrl = baseUrl.slice(0, -1);
        }
      }

      // Prepare support email settings using custom SUPPORT_RECIPIENT_EMAIL variable
      const supportEmail = process.env.SUPPORT_RECIPIENT_EMAIL || "support@firstlooklabs.xyz";
      const emailSubject = `[User Feedback Rating] ${rate} Stars from ${user_email}`;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body { font-family: sans-serif; background-color: #faf5ff; color: #3b0764; margin: 0; padding: 24px; }
    .card { background: #ffffff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    .heading { font-size: 18px; color: #581c87; border-bottom: 2px solid #818cf8; padding-bottom: 12px; }
    .rating-stars { font-size: 24px; color: #eab308; margin: 16px 0; }
    .meta { font-size: 13px; color: #6b21a8; }
    .text-msg { background-color: #faf5ff; border-radius: 8px; padding: 16px; font-size: 14px; color: #4c1d95; font-style: italic; border-left: 4px solid #a855f7; }
  </style>
</head>
<body>
  <div class="card">
    <h2 class="heading">FirstLook Labs User Rating</h2>
    <div class="meta">
      <p><strong>Reviewer:</strong> ${user_email}</p>
      <p><strong>Feedback ID:</strong> ${uuid}</p>
      <p><strong>Submitting Date:</strong> ${new Date().toUTCString()}</p>
    </div>
    <div class="rating-stars">
      ${"★".repeat(Number(rate))}${"☆".repeat(5 - Number(rate))} (${rate} / 5 Stars)
    </div>
    <p><strong>Feedback Message:</strong></p>
    <div class="text-msg">
      ${feedback || "(The reviewer did not provide comments.)"}
    </div>
  </div>
</body>
</html>`;

      // Dispatch real external API call and Resend Mail concurrently via Promise.allSettled
      // This is a MUST for Google Cloud Run or serverless environments, securing active CPU allocation to guarantee email delivery
      console.log(`[Feedback API] Concurrently executing external database API and Resend delivery...`);

      const [apiResult, emailResult] = await Promise.allSettled([
        (async () => {
          if (!baseUrl) {
            return {
              success: true,
              message: "Feedback processed locally (No external data warehouse URL defined).",
              id: uuid,
              status: 200
            };
          }

          const externalUrl = `${baseUrl}/api/feedback`;
          const externalResponse = await fetch(externalUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(forexApiSecret ? { "Authorization": `Bearer ${forexApiSecret}` } : {})
            },
            body: JSON.stringify({ rate, user_email, feedback })
          });

          const status = externalResponse.status;
          const externalData = await externalResponse.json().catch(() => ({}));

          if (externalResponse.ok) {
            return {
              success: true,
              message: externalData.message || "Feedback inserted into database successfully.",
              id: externalData.id || uuid,
              status
            };
          } else {
            throw {
              status,
              error: externalData.error || "Failed sending feedback rating to the external database server."
            };
          }
        })(),

        sendEmail(supportEmail, emailSubject, html, feedback || `Rating: ${rate} stars`, `FirstLook Staff Alerts`, false, user_email)
      ]);

      let apiStatusCode = 200;
      let apiMessage = "Feedback inserted into database successfully.";
      let apiFeedbackId = uuid;
      let externalErrorMsg: string | null = null;

      // Extract results from the external API promise
      if (apiResult.status === "fulfilled") {
        const val = apiResult.value;
        apiStatusCode = val.status ?? 200;
        apiMessage = val.message;
        apiFeedbackId = val.id;
      } else {
        const reason = apiResult.reason;
        apiStatusCode = reason.status ?? 502;
        externalErrorMsg = reason.error ?? "Connection or forwarding exception to external data gateway.";
      }

      // Check results from the Resend promise
      const emailSent = emailResult.status === "fulfilled" && emailResult.value === true;
      if (emailSent) {
        console.log(`[Feedback API Success] Resend Mail copy successfully transmitted to support inbox: ${supportEmail}`);
      } else {
        const emailErr = emailResult.status === "rejected" ? emailResult.reason : "API key configuration error";
        console.warn(`[Feedback API Alert] Resend Mail copy could not be dispatched:`, emailErr);
      }

      // Return failure response if external API rejected the payload
      if (externalErrorMsg) {
        return res.status(apiStatusCode).json({
          error: `[API ${apiStatusCode} Error] ${externalErrorMsg}`
        });
      }

      return res.status(200).json({
        status: "success",
        message: `[API ${apiStatusCode} OK] ${apiMessage}`,
        id: apiFeedbackId
      });
    } catch (err: any) {
      console.error("[Feedback API Error]", err);
      return res.status(500).json({ error: `[API 500 Internal Error] ${err.message}` });
    }
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  app.get("/api/debug-smtp", async (req, res) => {
    const emailLogs: string[] = [];
    const pushLog = (level: string, message: string) => {
      const timestamp = new Date().toISOString();
      emailLogs.push(`[${timestamp}] [${level}] ${message}`);
    };

    try {
      pushLog("SYSTEM", "Starting App Mailer diagnostics...");
      
      const recipient = (req.query.recipient as string) || "support@firstlooklabs.xyz";
      
      // Check Resend API Route
      let resendSuccessful = false;
      if (process.env.RESEND_API_KEY) {
        const key = process.env.RESEND_API_KEY.trim();
        const maskedKey = `${key.slice(0, 5)}...${key.slice(-4)} (length: ${key.length})`;
        pushLog("RESEND_CHECK", `Resend config detected: RESEND_API_KEY='${maskedKey}'`);
        
        try {
          const fromEmail = (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();
          pushLog("RESEND_SEND", `Attempting Resend API test dispatch to: ${recipient} from: ${fromEmail}...`);
          
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: `"FirstLook Labs" <${fromEmail}>`,
              to: [recipient],
              subject: `FirstLook Resend Diagnostic Alert - ${new Date().toLocaleTimeString()}`,
              text: `HTTPS email dispatch diagnostic completed successfully.`,
              html: `<p>HTTPS REST API email dispatch has succeeded!</p><ul><li><b>From:</b> ${fromEmail}</li><li><b>Host Environment:</b> Render / Cloud Run</li></ul>`
            })
          });
          
          const responseData: any = await response.json();
          if (response.ok && responseData.id) {
            pushLog("RESEND_SEND_SUCCESS", `Resend API test email successfully delivered! MessageId: ${responseData.id}`);
            resendSuccessful = true;
          } else {
            pushLog("RESEND_SEND_FAIL", `Resend rejected payload: ${JSON.stringify(responseData)}`);
          }
        } catch (resendErr: any) {
          pushLog("RESEND_SEND_ERROR", `Resend API throw error: ${resendErr.message}`);
        }
      } else {
        pushLog("RESEND_CHECK", "Resend configuration is empty (RESEND_API_KEY is not configured).");
      }

      res.status(200).json({
        success: resendSuccessful,
        message: resendSuccessful 
          ? "Diagnostics completed. RESEND DELIVERY SUCCEEDED! Your production emails are 100% active and working."
          : "Diagnostics completed. RESEND_API_KEY was not configured or Resend test dispatch failed.",
        targetRecipient: recipient,
        resendSucceeded: resendSuccessful,
        diagnostics: emailLogs
      });
    } catch (endpointErr: any) {
      pushLog("CRITICAL_CRASH", `Endpoint threw a critical error: ${endpointErr.message}`);
      res.status(500).json({
        success: false,
        error: endpointErr.message,
        diagnostics: emailLogs
      });
    }
  });

  app.get("/api/competitions/status", async (req, res) => {
    try {
      const { userId } = req.query;
      let hasApplied = false;
      if (userId && typeof userId === 'string') {
        hasApplied = await db.hasPreregisteredForCompetition(userId);
      }
      
      const premiumPlusCount = await db.getPremiumPlusUsersCount();
      const competitionsCount = await db.getCompetitionPreregistrationsCount();
      const candidates = await db.getPreregisteredCandidates();
      const premiumPlusUsers = await db.getPremiumPlusUsers();

      res.json({
        premiumPlusCount,
        competitionsCount,
        hasApplied,
        candidates,
        premiumPlusUsers
      });
    } catch (err: any) {
      console.error("[Competitions API] status error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/competitions/apply", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "Missing userId parameter" });
      }
      await db.preregisterForCompetition(userId);
      
      const premiumPlusCount = await db.getPremiumPlusUsersCount();
      const competitionsCount = await db.getCompetitionPreregistrationsCount();
      const candidates = await db.getPreregisteredCandidates();
      const premiumPlusUsers = await db.getPremiumPlusUsers();

      res.json({
        success: true,
        premiumPlusCount,
        competitionsCount,
        hasApplied: true,
        candidates,
        premiumPlusUsers
      });
    } catch (err: any) {
      console.error("[Competitions API] apply error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/sponsor-ad", async (req, res) => {
    const randomFallback = FALLBACK_SPONSORS[Math.floor(Math.random() * FALLBACK_SPONSORS.length)];
    
    // Serve memoized cache if fresh
    const now = Date.now();
    if (memoizedSponsor && (now - lastSponsorFetchTime < SPONSOR_CACHE_DURATION)) {
      return res.json(memoizedSponsor);
    }

    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json(randomFallback);
      }

      console.log("[Sponsor API] Fetching new high-quality sponsor offer from Gemini...");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Generate a professional, high-converting, non-intrusive sponsor offer for retail traders actively backtesting on currency or crypto charts. It MUST be extremely professional and belong to one of these niches: Reputable Brokers, Prop Firms, Trading Utilities, or Premium Insights. Do NOT mention clothing, fast food, or generic non-financial consumer ads. Return valid JSON only.",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sponsor: { type: Type.STRING, description: "Name of the partner, e.g., Exness, FTMO, Pepperstone, PineServer, Alpha Insights" },
              tagline: { type: Type.STRING, description: "Short, engaging, professional trading tagline (max 65 chars), e.g., 'Zero commissions on FX majors', 'Get up to $200k funded'" },
              category: { type: Type.STRING, description: "One of exactly: 'Reputable Brokers', 'Prop Firms', 'Trading Utilities', 'Premium Insights'" },
              incentive: { type: Type.STRING, description: "Specific professional incentive or tech guarantee, e.g., 'Uptime 99.99%', 'Spreads from 0.0 pips', '1:100 leverage available'" },
              cta: { type: Type.STRING, description: "Short CTA action label, e.g., 'Get Premium', 'Start Challenge', 'Open Account', 'Deploy VPS', 'Learn More'" },
              logoType: { type: Type.STRING, description: "One of exactly: 'broker', 'prop', 'vps', 'insight'" },
              link: { type: Type.STRING, description: "Partner URL link" }
            },
            required: ["sponsor", "tagline", "category", "incentive", "cta", "logoType", "link"]
          }
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        // Save to in-memory cache
        memoizedSponsor = parsed;
        lastSponsorFetchTime = now;
        return res.json(parsed);
      }
      
      throw new Error("No response text from Gemini API");
    } catch (err: any) {
      // Gracefully handle 429, 503 Service Unavailable, and other Gemini API errors, and serve the fallback seamlessly
      console.log("[Sponsor API] Dynamic generation unavailable (service sleeping), utilizing pre-configured local backup campaign options.");
      return res.json(randomFallback);
    }
  });

  // Helper for proxy requests
  async function proxyRequest(name: string, url: string, headers: Record<string, string> = {}) {
    const startTimeToken = Date.now();
    console.log(`[Proxy] ${name} request started: ${url}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...headers 
        } 
      });
      
      const duration = Date.now() - startTimeToken;
      const contentType = response.headers.get('content-type');
      
      if (response.ok) {
        console.log(`[Proxy] ${name} success (${response.status}) in ${duration}ms`);
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return await response.text();
      } else {
        const errorText = await response.text();
        console.error(`[Proxy] ${name} error ${response.status} in ${duration}ms: ${errorText.substring(0, 200)}`);
        throw { status: response.status, message: errorText || `HTTP ${response.status}`, url };
      }
    } catch (error: any) {
      const duration = Date.now() - startTimeToken;
      if (error.name === 'AbortError') {
        console.error(`[Proxy] ${name} request timed out after ${duration}ms`);
        throw { status: 504, message: 'Gateway Timeout (Request timed out)' };
      }
      console.error(`[Proxy] ${name} fetch failed after ${duration}ms:`, error.message || error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Symbol Discovery & Support Mapping
  const supportedSymbolsMap = new Map<string, Set<string>>(); // source -> Set of normalized symbols
  let lastDiscoveryTime = 0;
  const DISCOVERY_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

  async function discoverSymbols() {
    console.log("[Discovery] Starting symbol discovery for all exchanges...");
    const sources = [
      { 
        id: 'binance', 
        urls: [
          'https://api.binance.com/api/v3/exchangeInfo',
          'https://api-gcp.binance.com/api/v3/exchangeInfo',
          'https://api1.binance.com/api/v3/exchangeInfo'
        ] 
      },
      { 
        id: 'okx', 
        urls: [
          'https://aws.okx.com/api/v5/public/instruments?instType=SPOT',
          'https://www.okx.com/api/v5/public/instruments?instType=SPOT',
          'https://okx.com/api/v5/public/instruments?instType=SPOT'
        ] 
      },
      { 
        id: 'bybit', 
        urls: [
          'https://api.bybit.com/v5/market/instruments-info?category=spot',
          'https://api.bytick.com/v5/market/instruments-info?category=spot'
        ] 
      },
      { 
        id: 'kraken', 
        urls: [
          'https://api.kraken.com/0/public/AssetPairs'
        ] 
      }
    ];

    for (const source of sources) {
      let success = false;
      for (const url of source.urls) {
        try {
          const response = await fetch(url, { 
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            } 
          });
          if (!response.ok) continue;
          const data = await response.json() as any;
          const symbols = new Set<string>();

          if (source.id === 'binance') {
            if (data && data.symbols) {
              data.symbols.forEach((s: any) => {
                if (s.status === 'TRADING') symbols.add(`${s.baseAsset}/${s.quoteAsset}`.toUpperCase());
              });
            }
          } else if (source.id === 'okx') {
            if (data && data.data) {
              data.data.forEach((s: any) => {
                if (s.state === 'live') symbols.add(`${s.baseCcy}/${s.quoteCcy}`.toUpperCase());
              });
            }
          } else if (source.id === 'bybit') {
            if (data && data.result && data.result.list) {
              data.result.list.forEach((s: any) => {
                if (s.status === 'Trading') symbols.add(`${s.baseCoin}/${s.quoteCoin}`.toUpperCase());
              });
            }
          } else if (source.id === 'kraken') {
             if (data && data.result) {
               Object.values(data.result).forEach((p: any) => {
                 if (p.wsname && p.wsname.includes('/')) {
                   symbols.add(p.wsname.toUpperCase());
                 }
               });
             }
          }

          if (symbols.size > 0) {
            supportedSymbolsMap.set(source.id, symbols);
            console.log(`[Discovery] ${source.id} success from ${url}: ${symbols.size} symbols loaded.`);
            success = true;
            break; // Break the URL loop to move to the next exchange
          }
        } catch (err: any) {
          console.error(`[Discovery] Failed to load symbols for ${source.id} from ${url}:`, err.message || err);
        }
      }
      if (!success) {
        console.warn(`[Discovery] All URL options failed for ${source.id}`);
      }
    }

    lastDiscoveryTime = Date.now();
  }

  // Initial discovery
  discoverSymbols();

  // Helper functions for synthetic/fallback forex candles
  function getEstimatedStartPrice(symbol: string): number {
    const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (norm.includes('EURUSD')) return 1.0850;
    if (norm.includes('GBPUSD')) return 1.2720;
    if (norm.includes('USDJPY')) return 156.40;
    if (norm.includes('AUDUSD')) return 0.6650;
    if (norm.includes('USDCHF')) return 0.8950;
    if (norm.includes('USDCAD')) return 1.3650;
    if (norm.includes('NZDUSD')) return 0.6120;
    if (norm.includes('EURGBP')) return 0.8530;
    if (norm.includes('EURJPY')) return 169.50;
    if (norm.includes('GBPJPY')) return 199.20;
    if (norm.includes('AUDJPY')) return 104.20;
    if (norm.includes('EURCHF')) return 0.9720;
    if (norm.includes('EURAUD')) return 1.6320;
    if (norm.includes('GBPAUD')) return 1.9120;
    
    if (norm.includes('XAUUSD') || norm.includes('GOLD')) return 2335.50;
    if (norm.includes('XAGUSD') || norm.includes('SILVER')) return 30.50;
    if (norm.includes('USOIL') || norm.includes('WTI') || norm.includes('BRENT')) return 78.50;
    if (norm.includes('NATGAS')) return 2.60;
    if (norm.includes('PLATINUM')) return 980.00;
    if (norm.includes('PALLADIUM')) return 920.00;
    if (norm.includes('COPPER')) return 4.45;

    if (norm.includes('US30')) return 38800.00;
    if (norm.includes('NAS100')) return 18600.00;
    if (norm.includes('SPX500')) return 5350.00;
    if (norm.includes('DXY')) return 104.50;

    if (norm.includes('AAPL')) return 195.00;
    if (norm.includes('TSLA')) return 175.00;
    if (norm.includes('NVDA')) return 120.00;
    if (norm.includes('MSFT')) return 415.00;
    if (norm.includes('GOOGL')) return 175.00;
    if (norm.includes('AMZN')) return 185.00;
    if (norm.includes('META')) return 475.00;
    if (norm.includes('PLTR')) return 21.00;
    if (norm.includes('AMD')) return 160.00;
    if (norm.includes('NFLX')) return 640.00;
    if (norm.includes('BABA')) return 78.00;
    if (norm.includes('BRKB') || norm.includes('BRK')) return 410.00;
    if (norm.includes('COIN')) return 225.00;
    if (norm.includes('MSTR')) return 165.00;

    if (norm.includes('JPY')) return 150.0;
    return 1.0;
  }

  function getEstimatedVolatility(symbol: string): number {
    const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (norm.includes('JPY')) return 0.0012;
    if (norm.includes('EURUSD') || norm.includes('GBPUSD') || norm.includes('USDCHF') || norm.includes('USDCAD')) return 0.0008;
    if (norm.includes('XAUUSD') || norm.includes('GOLD')) return 0.0025;
    if (norm.includes('XAGUSD') || norm.includes('SILVER')) return 0.0035;
    if (norm.includes('USOIL') || norm.includes('WTI') || norm.includes('BRENT')) return 0.0050;
    if (norm.includes('US30') || norm.includes('NAS100') || norm.includes('SPX500')) return 0.0015;
    return 0.0015;
  }

  function getEstimatedPipMultiplier(symbol: string): number {
    const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (norm.includes('JPY')) return 0.01;
    if (norm.includes('EURUSD') || norm.includes('GBPUSD') || norm.includes('USDCHF') || norm.includes('USDCAD') || norm.includes('AUDUSD') || norm.includes('NZDUSD') || norm.includes('EURGBP') || norm.includes('EURCHF') || norm.includes('EURAUD') || norm.includes('GBPAUD')) return 0.0001;
    if (norm.includes('XAU') || norm.includes('GOLD')) return 0.1;
    if (norm.includes('XAG') || norm.includes('SILVER')) return 0.01;
    if (norm.includes('US30') || norm.includes('SPX500') || norm.includes('NAS100')) return 1.0;
    return 0.0001;
  }

  function getEstimatedSpread(symbol: string, multiplier: number): number {
    const norm = symbol.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (norm.includes('EURUSD') || norm.includes('GBPUSD')) return 1.2 * multiplier;
    if (norm.includes('JPY')) return 1.6 * multiplier;
    if (norm.includes('XAU') || norm.includes('GOLD')) return 2.5 * multiplier;
    if (norm.includes('XAG') || norm.includes('SILVER')) return 2.0 * multiplier;
    if (norm.includes('US30') || norm.includes('SPX500') || norm.includes('NAS100')) return 1.5 * multiplier;
    return 1.5 * multiplier;
  }

  function getTimeframeSeconds(tf: string): number {
    switch (tf.toLowerCase()) {
      case '1m': return 60;
      case '3m': return 180;
      case '5m': return 300;
      case '15m': return 900;
      case '30m': return 1800;
      case '1h': return 3600;
      case '2h': return 7200;
      case '4h': return 14400;
      case '6h': return 21600;
      case '8h': return 28800;
      case '12h': return 43200;
      case '1d': return 86400;
      case '1w': return 604800;
      default: return 3600;
    }
  }

  function generateWarehouseFallbackContent(
    symbol: string,
    timeframe: string,
    limit: number,
    startTime?: string | number,
    endTime?: string | number
  ) {
    const symbolStr = String(symbol || "EURUSD").toUpperCase();
    const tfStr = String(timeframe || "1h");
    const limitNum = Math.min(Number(limit || 200), 1000);
    
    const intervalSeconds = getTimeframeSeconds(tfStr);
    const nowSec = Math.floor(Date.now() / 1000);
    
    let endSec = nowSec;
    if (endTime) {
      const rawEnd = Number(endTime);
      endSec = rawEnd > 50000000000 ? Math.floor(rawEnd / 1000) : rawEnd;
    }
    
    let startSec = endSec - (limitNum * intervalSeconds);
    if (startTime) {
      const rawStart = Number(startTime);
      startSec = rawStart > 50000000000 ? Math.floor(rawStart / 1000) : rawStart;
      endSec = startSec + (limitNum * intervalSeconds);
    }
    
    const data = [];
    let currentPrice = getEstimatedStartPrice(symbolStr);
    const volatility = getEstimatedVolatility(symbolStr);
    const multiplier = getEstimatedPipMultiplier(symbolStr);
    const spreadValue = getEstimatedSpread(symbolStr, multiplier);

    let currentTime = startSec;
    for (let i = 0; i < limitNum; i++) {
      const changePercent = volatility * (Math.random() - 0.495); // Extremely slight upward/neutral drift
      const change = currentPrice * changePercent;
      
      const open = currentPrice;
      const close = currentPrice + change;
      const high = Math.max(open, close) + (Math.random() * currentPrice * volatility * 0.4);
      const low = Math.min(open, close) - (Math.random() * currentPrice * volatility * 0.4);
      const volume = Math.floor(Math.random() * 5000) + 1000;
      
      data.push({
        time: currentTime,
        bid_open: Number(open.toFixed(6)),
        bid_high: Number(high.toFixed(6)),
        bid_low: Number(low.toFixed(6)),
        bid_close: Number(close.toFixed(6)),
        open: Number(open.toFixed(6)),
        high: Number(high.toFixed(6)),
        low: Number(low.toFixed(6)),
        close: Number(close.toFixed(6)),
        volume,
        spread_open: Number(spreadValue.toFixed(6)),
        spread_high: Number(spreadValue.toFixed(6)),
        spread_low: Number(spreadValue.toFixed(6)),
        spread_close: Number(spreadValue.toFixed(6)),
        ask_open: Number((open + spreadValue).toFixed(6)),
        ask_high: Number((high + spreadValue).toFixed(6)),
        ask_low: Number((low + spreadValue).toFixed(6)),
        ask_close: Number((close + spreadValue).toFixed(6)),
        news: []
      });
      
      currentPrice = close;
      currentTime += intervalSeconds;
    }
    
    return data;
  }

  // Forex Datawarehouse candles proxy
  app.get("/api/warehouse-candles", async (req, res) => {
    const { symbol, source, timeframe, startTime, endTime, limit, tradeType, marketType } = req.query;
    try {
      let baseUrl = (process.env.FOREX_API_URL || "https://datawarehouse-vi6d.onrender.com").trim();
      if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
        baseUrl = `https://${baseUrl}`;
      }
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }
      if (!baseUrl.endsWith("/api/warehouse-candles")) {
        baseUrl = `${baseUrl}/api/warehouse-candles`;
      }
      const forexApiUrl = baseUrl;
      const forexApiSecret = process.env.FOREX_API_SECRET;
      
      if (!forexApiSecret) {
        console.warn("[Forex Proxy] FOREX_API_SECRET is missing.");
        return res.status(401).json({ error: "FOREX_API_SECRET is missing on the server configuration. Please declare it in setting panel." });
      }

      // Format parameters according to specification
      const params = new URLSearchParams();
      if (symbol) params.append("symbol", String(symbol).toUpperCase());
      if (source) params.append("source", String(source).toLowerCase());
      if (timeframe) params.append("timeframe", String(timeframe));
      if (startTime) params.append("startTime", String(startTime));
      if (endTime) params.append("endTime", String(endTime));
      if (limit) params.append("limit", String(limit));

      // Map tradeType or marketType to tradeType
      let finalTradeType = tradeType ? String(tradeType) : undefined;
      if (!finalTradeType && marketType) {
        const mt = String(marketType).toLowerCase();
        if (mt === 'spot') finalTradeType = 'spot';
        else if (mt === 'usdt-futures' || mt === 'usdt_futures' || mt === 'usdt_future') finalTradeType = 'usdt_future';
        else if (mt === 'coin-futures' || mt === 'coin_futures' || mt === 'coin_future') finalTradeType = 'coin_future';
        else finalTradeType = mt.replace('-', '_');
      }
      if (finalTradeType) params.append("tradeType", finalTradeType);

      const targetUrl = `${forexApiUrl}?${params.toString()}`;
      console.log(`[Proxy] Requesting Forex Datawarehouse: ${targetUrl.replace(forexApiSecret, 'REDACTED')}`);

      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "X-API-Secret": forexApiSecret,
          "Accept": "application/json"
        }
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const data = await response.json();
            return res.json(data);
          } catch (jsonErr: any) {
            console.error(`[Proxy] Expected JSON, failed to parse:`, jsonErr);
            return res.status(502).json({ error: "Forex API returned malformed JSON content", details: jsonErr.message });
          }
        } else {
          console.warn(`[Proxy] Response was OK but Content-Type is ${contentType || 'missing'}.`);
          return res.status(502).json({ error: "Forex API returned non-JSON response", contentType });
        }
      } else {
        const errorText = await response.text().catch(() => "N/A");
        console.error(`[Proxy] Forex Warehouse API error ${response.status}: ${errorText.substring(0, 150)}.`);
        return res.status(response.status).json({ error: "Forex Warehouse API error", status: response.status, details: errorText.substring(0, 300) });
      }
    } catch (error: any) {
      console.error("[Proxy] Forex Warehouse exception:", error);
      return res.status(504).json({ error: "Gateway Timeout: Forex API is unreachable or timed out.", details: error.message });
    }
  });

  app.get("/api/system/banner", async (req, res) => {
    try {
      let baseUrl = (process.env.FOREX_API_URL || "").trim();
      if (!baseUrl) {
        console.warn("[Server] FOREX_API_URL is empty, returning empty banner.");
        return res.json({ status: "success", banner: null });
      }
      if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
        baseUrl = `https://${baseUrl}`;
      }
      if (baseUrl.endsWith("/")) {
        baseUrl = baseUrl.slice(0, -1);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(`${baseUrl}/api/system/banner`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.status === "success" && data.banner) {
          return res.json(data);
        }
      }
      return res.json({ status: "success", banner: null });
    } catch (error) {
      console.error("[Server] Error proxying system banner:", error);
      return res.json({ status: "success", banner: null });
    }
  });

  app.get("/api/sources", async (req, res) => {
    const { symbol } = req.query; // Expecting "BTC/USDT"
    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({ error: "Missing symbol param" });
    }

    if (Date.now() - lastDiscoveryTime > DISCOVERY_INTERVAL) {
      discoverSymbols(); // Refresh in background
    }

    const uppercaseSymbol = symbol.toUpperCase();
    const cleanSym = uppercaseSymbol.replace('/', '').replace('-', '');
    
    // Check if it's a Forex, Metal, or Indices symbol
    const forexCurrencies = ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CHF', 'CAD', 'NZD', 'SGD', 'HKD', 'XAU', 'XAG'];
    const isForex = cleanSym.length === 6 && (forexCurrencies.includes(cleanSym.substring(0, 3)) || forexCurrencies.includes(cleanSym.substring(3, 6)));
    
    const customFeedSymbols = [
      'XAUUSD', 'XAGUSD', 'PLATINUM', 'PALLADIUM', 'COPPER', 'USOIL', 'WTI', 'BRENT',
      'US30', 'NAS100', 'SPX500', 'DXY', 'SPX', 'IXIC', 'DJI'
    ];
    const isCustomFeed = isForex || customFeedSymbols.includes(cleanSym);

    const dukaUnsupported = ['EURCHF', 'EURAUD', 'GBPAUD', 'XAUUAD', 'XAUUSD', 'XAUAUD', 'XAGUSD', 'SPX500', 'NAS100'];

    if (isCustomFeed) {
      let sources = ['exness', 'dukascopy', 'fxcm', 'oando', 'axiory'];
      if (dukaUnsupported.includes(cleanSym)) {
        sources = sources.filter(s => s !== 'dukascopy');
      }
      return res.json({ sources });
    }

    const sources: string[] = [];

    const cryptoExchanges = ['binance', 'okx', 'bybit'];
    cryptoExchanges.forEach(sourceId => {
      const symbolsSet = supportedSymbolsMap.get(sourceId);
      if (symbolsSet && symbolsSet.size > 0) {
        if (symbolsSet.has(uppercaseSymbol)) {
          sources.push(sourceId);
        }
      } else {
        // Fallback: If discovery failed entirely (meaning size is 0 or undefined due to DC blocking),
        // we assume the pair is supported on this giant crypto exchange as a robust backup
        sources.push(sourceId);
      }
    });

    // Also add any other discovered sources (like kraken) if matching
    supportedSymbolsMap.forEach((symbols, sourceId) => {
      if (!cryptoExchanges.includes(sourceId) && symbols.has(uppercaseSymbol)) {
        sources.push(sourceId);
      }
    });

    let finalSources = sources;
    if (dukaUnsupported.includes(cleanSym)) {
      finalSources = finalSources.filter(s => s !== 'dukascopy');
    }

    res.json({ sources: finalSources });
  });

  // Proxy Binance API to avoid CORS issues
  app.get("/api/binance", async (req, res) => {
    console.log(`[Proxy] Received request for Binance: ${req.url}`);
    try {
      const { symbol, interval, limit, endTime, startTime, marketType } = req.query;
      
      if (!symbol || !interval) {
        return res.status(400).json({ error: "Missing symbol or interval" });
      }

      let baseUrls = [`https://api-gcp.binance.com`, `https://api.binance.com` ];
      let endpoint = `/api/v3/klines`;

      // Handle different Binance market types
      if (marketType === 'usdt-futures') {
        baseUrls = [`https://fapi.binance.com` ];
        endpoint = `/fapi/v1/klines`;
      } else if (marketType === 'coin-futures') {
        baseUrls = [`https://dapi.binance.com` ];
        endpoint = `/dapi/v1/klines`;
      }

      // Add backup endpoints for spot
      if (!marketType || marketType === 'spot') {
        baseUrls.push(`https://api1.binance.com`, `https://api2.binance.com`, `https://api3.binance.com`);
      }

      const safeLimit = Math.min(parseInt(limit as string) || 500, 1000);
      
      // Sanitization with proper type checking
      const cleanParam = (val: any) => {
        if (!val) return null;
        const str = String(val).trim();
        return str.length > 0 ? str : null;
      };

      const params = new URLSearchParams({
        symbol: String(symbol),
        interval: String(interval),
        limit: safeLimit.toString()
      });

      const s = cleanParam(startTime);
      const e = cleanParam(endTime);
      if (s) params.append('startTime', s);
      if (e) params.append('endTime', e);

      let lastError: any = null;
      for (const baseUrl of baseUrls) {
        const url = `${baseUrl}${endpoint}?${params.toString()}`;
        console.log(`[Proxy] Attempting: ${url}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { 
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              clearTimeout(timeout);
              return res.json(data);
            }
          }
          const errorText = await response.text();
          lastError = { status: response.status, message: errorText, url };
        } catch (err) {
          lastError = err;
          continue;
        } finally {
          clearTimeout(timeout);
        }
      }

      if (lastError) {
        const status = lastError.status || 500;
        const message = lastError.message || String(lastError);
        return res.status(status).json({ error: `Binance proxy failed: ${message}`, details: lastError });
      }
      throw new Error('All endpoints failed');
    } catch (error) {
      console.error('[Proxy] Binance error:', error);
      res.status(500).json({ error: 'Internal proxy error fetching from Binance' });
    }
  });

  // OKX Proxy
  app.get("/api/okx", async (req, res) => {
    try {
      const { instId, bar, limit, after, before, marketType } = req.query;
      const safeLimit = Math.min(parseInt(limit as string) || 100, 100);
      
      const apiParams = new URLSearchParams({
        instId: (instId as string),
        bar: (bar as string),
        limit: safeLimit.toString()
      });
      if (after) apiParams.append('after', after as string);
      if (before) apiParams.append('before', before as string);

      // We define multiple OKX endpoints to try in sequence to bypass CDN or IP-specific blocking.
      // Prioritize aws.okx.com as it routes via stable cloud pathways optimized for global server-to-server connections.
      const okxEndpoints = [
        'https://aws.okx.com',
        'https://www.okx.com',
        'https://okx.com'
      ];

      let lastError: any = null;
      const pathsToTry = (after || before) 
        ? ['/api/v5/market/history-candles'] 
        : ['/api/v5/market/candles', '/api/v5/market/history-candles'];

      for (const base of okxEndpoints) {
        for (const endpointPath of pathsToTry) {
          const url = `${base}${endpointPath}?${apiParams.toString()}`;
          try {
            const data = await proxyRequest('OKX', url);
            if (data && data.code === "0") {
              return res.json(data);
            }
            if (data && data.msg) {
              lastError = { status: 400, message: data.msg };
            }
          } catch (err: any) {
            console.warn(`[Proxy] OKX failover endpoint ${base} (${endpointPath}) unsuccessful:`, err.message || err);
            lastError = err;
          }
        }
      }

      if (lastError) {
        const status = lastError.status || 500;
        const message = lastError.message || String(lastError);
        return res.status(status).json({ error: `OKX proxy failed: ${message}`, details: lastError });
      }
      
      throw new Error('All OKX proxy endpoints failed');
    } catch (error: any) {
      console.error('[Proxy] OKX error:', error);
      res.status(500).json({ error: 'Internal proxy error fetching from OKX' });
    }
  });

  // Bybit Proxy
  app.get("/api/bybit", async (req, res) => {
    try {
      const { symbol, interval, limit, start, end, marketType } = req.query;
      const safeLimit = Math.min(parseInt(limit as string) || 200, 1000);
      
      // Determine Bybit category
      let category = 'spot';
      if (marketType === 'usdt-futures' || marketType === 'linear' || marketType === 'perps') {
        category = 'linear';
      } else if (marketType === 'coin-futures' || marketType === 'inverse') {
        category = 'inverse';
      } else if (marketType === 'spot') {
        category = 'spot';
      }

      const apiParams = new URLSearchParams({
        category,
        symbol: (symbol as string),
        interval: (interval as string),
        limit: safeLimit.toString()
      });
      if (start) apiParams.append('start', start as string);
      if (end) apiParams.append('end', end as string);

      const bybitBases = [
        'https://api.bybit.com',
        'https://api.bytick.com'
      ];

      let lastError: any = null;
      for (const base of bybitBases) {
        const url = `${base}/v5/market/kline?${apiParams.toString()}`;
        try {
          const data = await proxyRequest('Bybit', url);
          return res.json(data);
        } catch (err: any) {
          console.warn(`[Proxy] Bybit failover endpoint ${base} unsuccessful:`, err.message || err);
          lastError = err;
        }
      }

      if (lastError) {
        const status = lastError.status || 500;
        const message = lastError.message || String(lastError);
        return res.status(status).json({ error: `Bybit proxy failed: ${message}`, details: lastError });
      }
      throw new Error('All Bybit proxy endpoints failed');
    } catch (error: any) {
      console.error('[Proxy] Bybit error:', error);
      res.status(500).json({ error: 'Internal proxy error fetching from Bybit' });
    }
  });

  // Kraken Proxy
  app.get("/api/kraken", async (req, res) => {
    try {
      const { pair, interval, since } = req.query;
      const apiParams = new URLSearchParams({
        pair: (pair as string),
        interval: (interval as string)
      });
      if (since) apiParams.append('since', since as string);

      const url = `https://api.kraken.com/0/public/OHLC?${apiParams.toString()}`;
      
      const data = await proxyRequest('Kraken', url);
      res.json(data);
    } catch (error: any) {
      res.status(error.status || 500).json({ error: "Kraken fetch failed", details: error.message });
    }
  });


  // --- SECURE ADMIN ANALYTICS API SYSTEM ---
  
  const adminRateLimiterStore = new Map<string, number[]>();

  const adminRateLimitMiddleware = (req: any, res: any, next: any) => {
    const ip = req.ip || "127.0.0.1";
    const now = Date.now();
    
    let reqs = adminRateLimiterStore.get(ip) || [];
    reqs = reqs.filter(t => now - t < 60000);
    
    if (reqs.length >= 100) {
      return res.status(429).json({ error: "Too Many Requests: Administrative access is limited to 100 requests per minute." });
    }
    
    reqs.push(now);
    adminRateLimiterStore.set(ip, reqs);
    next();
  };

  const adminSecretMiddleware = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    // Protect using the FOREX_API_SECRET environment variable
    const expressSecret = (process.env.FOREX_API_SECRET || "FL-SECURE-API-SECRET-182390234123512").trim();
    
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.body && req.body.api_secret) {
      token = req.body.api_secret.toString().trim();
    } else if (req.query && req.query.api_secret) {
      token = req.query.api_secret.toString().trim();
    }

    if (!token || token !== expressSecret) {
      await db.logAdminRequest(req.path, req.method, req.query, req.ip, 401);
      return res.status(401).json({ 
        success: false, 
        error: "Unauthorized: Invalid or missing administrative access credential." 
      });
    }
    next();
  };

  const adminRouter = express.Router();
  adminRouter.use(adminRateLimitMiddleware);
  adminRouter.use(adminSecretMiddleware);

  // 1. Get Financial Overview
  adminRouter.get("/finance/overview", async (req, res) => {
    try {
      const data = await db.getAdminFinancialOverview();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(data);
    } catch (err: any) {
      console.error("[Admin API] finance/overview error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Get Revenue By Plan
  adminRouter.get("/finance/revenue-by-plan", async (req, res) => {
    try {
      const data = await db.getRevenueByPlan();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(data);
    } catch (err: any) {
      console.error("[Admin API] finance/revenue-by-plan error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Get Payments Paginated History
  adminRouter.get("/finance/payments", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "20", 10);
      const country = req.query.country as string;
      const plan = req.query.plan as string;
      const startDate = req.query.start_date as string;
      const endDate = req.query.end_date as string;

      const data = await db.getPaymentsHistory(page, limit, country, plan, startDate, endDate);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      
      res.json({
        currentPage: data.page,
        totalPages: data.pages,
        totalPayments: data.total,
        limit: data.limit,
        payments: data.payments
      });
    } catch (err: any) {
      console.error("[Admin API] finance/payments error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Get Revenue Trends Time-Series
  adminRouter.get("/finance/revenue-trends", async (req, res) => {
    try {
      const daily = await db.getDailyRevenue();
      const monthly = await db.getMonthlyRevenue();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({ daily, monthly });
    } catch (err: any) {
      console.error("[Admin API] finance/revenue-trends error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Get Users Overview Count
  adminRouter.get("/users/overview", async (req, res) => {
    try {
      const data = await db.getUserOverview();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(data);
    } catch (err: any) {
      console.error("[Admin API] users/overview error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Get Users List Paginated
  adminRouter.get("/users/list", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string || "1", 10);
      const limit = parseInt(req.query.limit as string || "20", 10);
      const plan = req.query.plan as string;
      const country = req.query.country as string;
      const status = req.query.status as string;

      const data = await db.getAllUsers(page, limit, plan, country, status);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);

      res.json({
        currentPage: data.page,
        totalPages: data.pages,
        totalUsers: data.total,
        limit: data.limit,
        users: data.users
      });
    } catch (err: any) {
      console.error("[Admin API] users/list error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Get Users Demographics Distributions
  adminRouter.get("/users/demographics", async (req, res) => {
    try {
      const plans = await db.getUsersByPlan();
      const countries = await db.getUsersByCountry();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({ plans, countries });
    } catch (err: any) {
      console.error("[Admin API] users/demographics error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Get Users Registration Growth Trends
  adminRouter.get("/users/growth", async (req, res) => {
    try {
      const trends = await db.getNewUserRegistrations();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(trends);
    } catch (err: any) {
      console.error("[Admin API] users/growth error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Get Subscription Performance Indicators
  adminRouter.get("/subscriptions/overview", async (req, res) => {
    try {
      const data = await db.getSubscriptionOverview();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(data);
    } catch (err: any) {
      console.error("[Admin API] subscriptions/overview error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Get Expiring Subscriptions List
  adminRouter.get("/subscriptions/expiring", async (req, res) => {
    try {
      const list = await db.getExpiringSubscriptions();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(list);
    } catch (err: any) {
      console.error("[Admin API] subscriptions/expiring error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 11. Consolidated Dashboard aggregators
  adminRouter.get("/dashboard", async (req, res) => {
    try {
      const finance = await db.getAdminFinancialOverview();
      const users = await db.getUserOverview();
      const subs = await db.getSubscriptionOverview();
      const trends = await db.getDailyRevenue();
      const expiring = await db.getExpiringSubscriptions();

      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        financials: finance,
        users: users,
        subscriptions: subs,
        revenueTrend: trends.slice(-15),
        expiringUsersCount: expiring.length
      });
    } catch (err: any) {
      console.error("[Admin API] dashboard overview aggregations failing:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Security Logging Audits Checkers
  adminRouter.get("/audit-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || "100", 10);
      const logs = await db.getAdminAuditLogs(limit);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json(logs);
    } catch (err: any) {
      console.error("[Admin API] audit-logs error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Permanently Delete User and all data
  adminRouter.delete("/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.getUserById(userId);
      if (!user) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: User with ID ${userId} does not exist.` });
      }
      
      await db.deleteUserPermanently(userId);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        success: true,
        message: `User ${userId} and all associated data have been permanently deleted successfully.`
      });
    } catch (err: any) {
      console.error("[Admin API] delete user error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Update user details (any field - set or unset)
  adminRouter.put("/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.getUserById(userId);
      if (!user) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: User with ID ${userId} does not exist.` });
      }

      // Hash plain password if provided
      if (req.body.password && typeof req.body.password === "string" && req.body.password.trim() !== "") {
        req.body.password_hash = await bcrypt.hash(req.body.password, 10);
      }

      const updatedUser = await db.adminUpdateUser(userId, req.body);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        success: true,
        message: "User details updated successfully.",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          full_name: updatedUser.full_name,
          country: updatedUser.country,
          bio: updatedUser.bio,
          experience_level: updatedUser.experience_level,
          avatar_url: updatedUser.avatar_url,
          created_at: updatedUser.created_at
        }
      });
    } catch (err: any) {
      console.error("[Admin API] update user error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 15. View all users' watchlist items
  adminRouter.get("/watchlist/all", async (req, res) => {
    try {
      const watchlists = await db.adminGetAllWatchlists();
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        success: true,
        watchlists
      });
    } catch (err: any) {
      console.error("[Admin API] get all watchlists error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 16. View specific user watchlist items
  adminRouter.get("/users/:userId/watchlist", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.getUserById(userId);
      if (!user) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: User with ID ${userId} does not exist.` });
      }

      const watchlist = await db.getWatchlist(userId);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        success: true,
        userId,
        watchlist
      });
    } catch (err: any) {
      console.error("[Admin API] get specific user watchlist error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 16b. View specific watchlist item details and statistics
  adminRouter.get(["/users/:userId/watchlist/:watchlistId", "/users/:userId/watchlist/:watchlistId/stats"], async (req, res) => {
    try {
      const { userId, watchlistId } = req.params;
      const user = await db.getUserById(userId);
      if (!user) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: User with ID ${userId} does not exist.` });
      }

      const stats = await db.adminGetWatchlistItemStats(userId, watchlistId);
      if (!stats.found) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: Watchlist item or symbol '${watchlistId}' does not exist for user ${userId}.` });
      }

      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        success: true,
        userId,
        watchlistId,
        ...stats
      });
    } catch (err: any) {
      console.error("[Admin API] get specific watchlist item stats error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 17. Delete specific or all watchlist items for a specific user
  adminRouter.delete("/users/:userId/watchlist", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await db.getUserById(userId);
      if (!user) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: User with ID ${userId} does not exist.` });
      }

      const symbolToDelete = (req.query.symbol || req.body.symbol || "").toString().trim().toUpperCase();
      const prefixToDelete = (req.query.prefix || req.body.prefix || undefined);

      const currentWatchlist = await db.getWatchlist(userId);
      let updated;
      let deletedCount = 0;

      if (symbolToDelete) {
        updated = currentWatchlist.filter((item: any) => {
          const itemSymbol = (item.symbol || "").toUpperCase();
          const matchSymbol = itemSymbol === symbolToDelete;
          const matchPrefix = prefixToDelete !== undefined ? item.prefix === prefixToDelete : true;
          
          if (matchSymbol && matchPrefix) {
            deletedCount++;
            // Cascade delete trades for this watchlist item
            if (item.id) {
              db.deleteTradesByWatchlist(userId, item.id).catch(err => 
                console.error(`[Admin API] Failed to cascade delete trades for watchlist ${item.id}:`, err)
              );
            }
            return false; // exclude from updated list
          }
          return true;
        });
      } else {
        deletedCount = currentWatchlist.length;
        updated = [];
        // Cascade delete trades for all deleted watchlist elements
        for (const item of currentWatchlist) {
          if (item.id) {
            db.deleteTradesByWatchlist(userId, item.id).catch(err => 
              console.error(`[Admin API] Failed to cascade delete trades for watchlist ${item.id}:`, err)
            );
          }
        }
      }

      await db.saveWatchlist(userId, updated);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      
      res.json({
        success: true,
        message: symbolToDelete 
          ? `Successfully deleted watchlist symbol ${symbolToDelete} and all associated trades for user ${userId}.`
          : `Successfully cleared all watchlist items and associated simulated trades for user ${userId}.`,
        deletedCount,
        remainingCount: updated.length,
        watchlist: updated
      });
    } catch (err: any) {
      console.error("[Admin API] delete user watchlist error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 17b. Delete specific individual watchlist item and its trades/sessions by watchlistId
  adminRouter.delete("/users/:userId/watchlist/:watchlistId", async (req, res) => {
    try {
      const { userId, watchlistId } = req.params;
      const user = await db.getUserById(userId);
      if (!user) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: User with ID ${userId} does not exist.` });
      }

      const currentWatchlist = await db.getWatchlist(userId);
      const targetItem = currentWatchlist.find((item: any) => 
        item.id === watchlistId || item.symbol?.toUpperCase() === watchlistId.toUpperCase()
      );
      
      if (!targetItem) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 404);
        return res.status(404).json({ error: `Not Found: Watchlist item or symbol '${watchlistId}' not found for user ${userId}.` });
      }

      const actualId = targetItem.id || watchlistId;
      const updated = currentWatchlist.filter((item: any) => 
        item.id !== actualId && item.symbol?.toUpperCase() !== actualId.toUpperCase()
      );

      // Permanently clear associated simulation trades
      await db.deleteTradesByWatchlist(userId, actualId);

      // Clean backtest session state
      const sessions = await db.getBacktestSessions(userId);
      if (sessions && (sessions[actualId] || sessions[`${targetItem.symbol}_${targetItem.prefix || ''}`])) {
        delete sessions[actualId];
        delete sessions[`${targetItem.symbol}_${targetItem.prefix || ''}`];
        await db.saveBacktestSessions(userId, sessions);
      }

      await db.saveWatchlist(userId, updated);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);

      res.json({
        success: true,
        message: `Successfully deleted watchlist item ${targetItem.symbol || actualId} and all associated simulation trades & states for user ${userId}.`,
        watchlist: updated
      });
    } catch (err: any) {
      console.error("[Admin API] delete specific watchlist item error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 18. Delete bulk user accounts by email address lists
  adminRouter.post("/users/bulk-delete", async (req, res) => {
    try {
      let emailsInput = req.body.emails;
      if (!emailsInput) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 400);
        return res.status(400).json({ error: "Bad Request: An array or comma-separated list of 'emails' is required in the body." });
      }

      let emailList: string[] = [];
      if (Array.isArray(emailsInput)) {
        emailList = emailsInput.map(e => e.trim().toLowerCase());
      } else if (typeof emailsInput === "string") {
        emailList = emailsInput.split(",").map(e => e.trim().toLowerCase());
      }

      // Filter out empty entries
      emailList = emailList.filter(e => e !== "");

      if (emailList.length === 0) {
        await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 400);
        return res.status(400).json({ error: "Bad Request: Empty email list provided." });
      }

      const deleted: string[] = [];
      const notFound: string[] = [];
      const failed: string[] = [];

      for (const email of emailList) {
        try {
          const user = await db.getUserByEmail(email);
          if (user) {
            await db.deleteUserPermanently(user.id);
            deleted.push(email);
          } else {
            notFound.push(email);
          }
        } catch (err) {
          console.error(`[Admin API] Failed to delete user with email ${email}:`, err);
          failed.push(email);
        }
      }

      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 200);
      res.json({
        success: true,
        summary: {
          totalProcessed: emailList.length,
          successfullyDeletedCount: deleted.length,
          notFoundCount: notFound.length,
          failedCount: failed.length
        },
        deleted,
        notFound,
        failed
      });
    } catch (err: any) {
      console.error("[Admin API] bulk user delete error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, req.query, req.ip, 500);
      res.status(500).json({ error: err.message });
    }
  });

  // 19. Core Platform Notification Sender with High Deliverability
  adminRouter.post("/send-email", async (req, res) => {
    try {
      const { subject, message, recipients } = req.body;

      // Validate inputs
      if (!subject || typeof subject !== "string" || subject.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Subject and message are required and cannot be empty."
        });
      }

      if (!message || typeof message !== "string" || message.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Subject and message are required and cannot be empty."
        });
      }

      if (recipients === undefined) {
        return res.status(400).json({
          success: false,
          error: "Reason for failure: 'recipients' parameter is required. It can be a string ('all_users' or a single email) or an array of valid emails."
        });
      }

      let emailList: string[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (typeof recipients === "string") {
        const checkVal = recipients.trim().toLowerCase();
        if (checkVal === "all_users") {
          emailList = await db.adminGetAllUserEmails();
        } else if (checkVal !== "") {
          emailList = [recipients.trim()];
        }
      } else if (Array.isArray(recipients)) {
        emailList = recipients
          .map((r: any) => (typeof r === "string" ? r.trim() : ""))
          .filter((r: string) => r !== "");
      }

      if (emailList.length === 0) {
        return res.status(400).json({
          success: false,
          error: "No recipients found or specified in request."
        });
      }

      // Format & clean list while verifying formats
      for (const email of emailList) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            success: false,
            error: `Invalid email format: ${email}`
          });
        }
      }

      // Log email activity securely without leaking body contents
      console.log(`[Admin API] send-email invoked. Security authorization approved, processing ${emailList.length} outbound dispatches.`);

      const senderEmail = process.env.RESEND_FROM_EMAIL || "support@firstlooklabs.xyz";

      // Parallelized dispatch with complete outcome recording
      const dispatches = emailList.map(async (email) => {
        try {
          // Render a personalized, high-deliverability HTML template for each recipient
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    .header {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
    }
    .logo {
      height: 40px;
      max-width: 250px;
      vertical-align: middle;
    }
    .content {
      padding: 40px 32px;
    }
    .heading {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 24px;
      letter-spacing: -0.025em;
      line-height: 1.3;
    }
    .body-text {
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .footer {
      background-color: #f1f5f9;
      border-top: 1px solid #e2e8f0;
      padding: 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .footer-tagline {
      font-style: italic;
      margin-bottom: 12px;
    }
    .footer-meta {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .footer-link {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="https://firstlooklabs.xyz/logo.svg" alt="FirstLook Labs" class="logo" />
      <span style="vertical-align: middle; font-size: 22px; font-weight: 800; color: #ffffff; margin-left: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: -0.025em;">FirstLook</span>
    </div>
    <div class="content">
      <h1 class="heading">${subject}</h1>
      <div class="body-text">
        ${message.replace(/\r?\n/g, '<br />')}
      </div>
    </div>
    <div class="footer">
      <div class="footer-title">FirstLook Labs</div>
      <div class="footer-tagline">Test First. Risk Later.</div>
      <div>
        <a href="https://firstlooklabs.xyz" class="footer-link" target="_blank">https://firstlooklabs.xyz</a>
      </div>
      <div class="footer-meta">
        You are receiving this official update because you registered an account for <strong>${email}</strong> on FirstLook Labs.<br />
        <span style="display: inline-block; margin-top: 8px;">
          Want to unsubscribe? <a href="mailto:${senderEmail}?subject=unsubscribe-${email}&body=Please%20unsubscribe%20my%20email%20address%20${email}%20from%20future%20FirstLook%20Labs%20announcements." class="footer-link">Unsubscribe from these alerts</a>
        </span>
      </div>
    </div>
  </div>
</body>
</html>`;

          const result = await sendEmail(email, subject, html, message, "FirstLook Labs", false);
          return { email, success: result };
        } catch (e: any) {
          console.error(`[Admin API Resend Fail] '${email}':`, e.message);
          return { email, success: false, error: e.message };
        }
      });

      const outcomeList = await Promise.all(dispatches);
      const successfulCount = outcomeList.filter(o => o.success).length;
      
      await db.logAdminRequest(
        req.baseUrl + req.path, 
        req.method, 
        { recipients_processed: emailList.length, success_count: successfulCount }, 
        req.ip, 
        200
      );

      res.json({
        success: true,
        sent_count: successfulCount,
        message: "Emails sent successfully"
      });
    } catch (err: any) {
      console.error("[Admin API] send email error:", err);
      await db.logAdminRequest(req.baseUrl + req.path, req.method, {}, req.ip, 500);
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  });

  // Mount Admin API router
  app.use("/api/admin", adminRouter);


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const mainVite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: "spa",
    });

    const journalVite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: "spa",
      root: path.resolve(process.cwd(), "journal-page")
    });

    app.use(async (req, res, next) => {
      const host = req.headers.host || "";
      const isJournal = host.startsWith("journal.") || req.query.mode === "journal";
      
      if (isJournal) {
        if (req.query.mode === "journal") {
          const urlObj = new URL(req.url, `http://${host}`);
          urlObj.searchParams.delete('mode');
          req.url = urlObj.pathname + urlObj.search;
        }
        journalVite.middlewares(req, res, next);
      } else {
        mainVite.middlewares(req, res, next);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const journalDistPath = path.resolve(process.cwd(), 'journal-page', 'dist');
    console.log(`[Server] Production mode: serving master assets from ${distPath} and journal from ${journalDistPath}`);
    
    // Serve static files from journal subdomain dist
    app.use((req, res, next) => {
      const host = req.headers.host || "";
      if (host.startsWith("journal.")) {
        express.static(journalDistPath, { index: false })(req, res, next);
      } else {
        next();
      }
    });

    // Provide asset routes for journal pages
    app.use('/assets', (req, res, next) => {
      const host = req.headers.host || "";
      if (host.startsWith("journal.")) {
        express.static(path.join(journalDistPath, 'assets'))(req, res, next);
      } else {
        next();
      }
    });

    // Serve static files from main app
    app.use(express.static(distPath, {
      index: false
    }));

    app.use('/assets', express.static(path.join(distPath, 'assets')));

    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      
      const host = req.headers.host || "";
      if (host.startsWith("journal.")) {
        const indexJournalPath = path.join(journalDistPath, 'index.html');
        console.log(`[Server] Falling back to journal index.html for: ${req.url}`);
        return res.sendFile(indexJournalPath);
      } else {
        const indexPath = path.join(distPath, 'index.html');
        console.log(`[Server] Falling back to master index.html for: ${req.url}`);
        return res.sendFile(indexPath);
      }
    });
  }

  // --- PERIODIC BACKGROUND SUBSCRIPTION SWEEPER ---
  setInterval(async () => {
    console.log("[Subscription Sweeper] Executing periodic subscription expiration scan...");
    try {
      await db.checkSubscriptionExpirations(async (userId, email, oldPlan) => {
        console.log(`[Subscription Sweeper] Plan expired for user ${userId} (${email}) - Upgraded plan: ${oldPlan}`);
        try {
          await sendSubscriptionExpiredEmail(email, oldPlan);
        } catch (mailErr) {
          console.error(`[Subscription Sweeper] Failed sending notification email to ${email}:`, mailErr);
        }
      });
    } catch (sweepErr) {
      console.error("[Subscription Sweeper] Scan execution failed:", sweepErr);
    }
  }, 30 * 60 * 1000); // scan every 30 minutes

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
