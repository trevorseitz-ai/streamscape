/**
 * Runs security + Maestro smoke gates, writes qa-audit-summary.json, optionally emails via Resend.
 *
 * Prerequisites (smoke): MAESTRO_TEST_USER_EMAIL, MAESTRO_TEST_USER_PASSWORD, Maestro + device/APK (com.reeldive.app).
 * Email: RESEND_API_KEY, REPORT_EMAIL (recipient). Optional RESEND_FROM (default uses Resend onboarding sender).
 *
 * Exit: 0 if both gates exit 0; 1 otherwise. If **`RESEND_API_KEY`** and **`REPORT_EMAIL`** are set, a failed Resend request also exits 1.
 * Run: npm run report:qa
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotenv({ path: path.join(ROOT, '.env') });
loadDotenv({ path: path.join(ROOT, '.env.local'), override: true });

const SUMMARY_PATH = path.join(ROOT, 'qa-audit-summary.json');

function readPkgVersion(): string {
  const raw = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8');
  const j = JSON.parse(raw) as { version?: unknown };
  return typeof j.version === 'string' ? j.version : 'unknown';
}

function npmExecutable(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function gitHead(): string | undefined {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
  if (r.status !== 0) return undefined;
  return r.stdout?.trim() || undefined;
}

function runNpmScript(scriptName: string): { durationMs: number; exitCode: number } {
  const started = Date.now();
  const r = spawnSync(npmExecutable(), ['run', scriptName], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  const exitCode =
    typeof r.status === 'number'
      ? r.status
      : r.error != null || r.signal != null
        ? 1
        : 1;
  return { durationMs: Date.now() - started, exitCode };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function dispatchResend(args: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
}

async function main(): Promise<void> {
  const appVersion = readPkgVersion();

  const security = runNpmScript('check:env-security');
  const smoke = runNpmScript('test:smoke-maestro');

  const okSecurity = security.exitCode === 0;
  const okSmoke = smoke.exitCode === 0;
  const reportStatus = okSecurity && okSmoke ? 'PASS' : 'FAIL';

  const summary = {
    timestamp: new Date().toISOString(),
    commit: gitHead(),
    appVersion,
    reportStatus,
    check_env_security: {
      ok: okSecurity,
      exitCode: security.exitCode,
      durationMs: security.durationMs,
    },
    maestro_smoke: {
      ok: okSmoke,
      exitCode: smoke.exitCode,
      durationMs: smoke.durationMs,
    },
  };

  fs.writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  console.log(`Wrote ${path.relative(process.cwd(), SUMMARY_PATH)} (${reportStatus})`);

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const reportTo = process.env.REPORT_EMAIL?.trim();

  if (resendKey && reportTo) {
    const from =
      process.env.RESEND_FROM?.trim() || 'ReelDive QA <onboarding@resend.dev>';

    const securityLabel = okSecurity ? 'PASS' : 'FAIL';
    const smokeLabel = okSmoke ? 'PASS' : 'FAIL';

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h1 style="font-size:1.25rem">ReelDive QA audit</h1>
  <p><strong>App version:</strong> ${escapeHtml(appVersion)}</p>
  <p><strong>Overall:</strong> ${escapeHtml(reportStatus)}</p>
  <table style="border-collapse:collapse;margin-top:1rem">
    <tr><td style="padding:6px 12px 6px 0;border-bottom:1px solid #eee"><strong>Security</strong></td><td style="padding:6px 0;border-bottom:1px solid #eee">npm run check:env-security — <strong>${escapeHtml(securityLabel)}</strong> (exit ${security.exitCode})</td></tr>
    <tr><td style="padding:6px 12px 6px 0"><strong>UI smoke</strong></td><td style="padding:6px 0">npm run test:smoke-maestro — <strong>${escapeHtml(smokeLabel)}</strong> (exit ${smoke.exitCode})</td></tr>
  </table>
  <p style="margin-top:1.25rem;font-size:0.875rem;color:#555">Digest generated at ${escapeHtml(summary.timestamp)}${summary.commit ? ` · commit <code>${escapeHtml(summary.commit.slice(0, 7))}</code>` : ''}</p>
</body>
</html>`;

    const recipients = reportTo.split(',').map((e) => e.trim()).filter(Boolean);
    await dispatchResend({
      apiKey: resendKey,
      from,
      to: recipients,
      subject:
        reportStatus === 'PASS'
          ? `ReelDive QA PASS · v${appVersion}`
          : `ReelDive QA FAIL · v${appVersion}`,
      html,
    });
    console.log(`Email sent via Resend to ${recipients.join(', ')}`);
  } else {
    console.warn(
      'Skipping email (set RESEND_API_KEY and REPORT_EMAIL to dispatch).',
    );
  }

  process.exitCode = reportStatus === 'PASS' ? 0 : 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
