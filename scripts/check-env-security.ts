/**
 * Flags likely hardcoded secrets in source files. Sensitive values must flow from
 * `process.env.*` / build-time injection — never from string literals.
 *
 * Run: `npm run check:env-security` or `npx tsx scripts/check-env-security.ts`
 * CI: exits 1 when any forbidden pattern matches.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'build',
  'coverage',
  '.cursor',
]);

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const SKIP_ROOT_DIRS = new Set(['android', 'ios']);

const ALLOW_FILES = new Set([path.join(ROOT, 'scripts', 'check-env-security.ts')]);

type Rule = { id: string; re: RegExp; hint: string };

const RULES: Rule[] = [
  {
    id: 'openai-sk',
    re: /\bsk-(?:proj-|live-|ant-)?[a-zA-Z0-9-_]{24,}\b/g,
    hint: 'OpenAI-style API key literal — use process.env.',
  },
  {
    id: 'aws-akia',
    re: /\bAKIA[0-9A-Z]{16}\b/g,
    hint: 'AWS access key id — use process.env.',
  },
  {
    id: 'slack-token',
    re: /\bxox[baprs]-[0-9]{10,}-[0-9a-zA-Z-]{10,}/g,
    hint: 'Slack token — server env only.',
  },
  {
    id: 'github-token',
    re: /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{20,})\b/g,
    hint: 'GitHub PAT — use process.env.',
  },
  {
    id: 'private-key-block',
    re: /-----BEGIN [A-Z ]+PRIVATE KEY-----/g,
    hint: 'PEM private key — never commit.',
  },
  {
    id: 'supabase-jwt-shape',
    re: /['\"]eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+['\"]/g,
    hint: 'JWT-shaped literal — prefer env (Supabase/Auth tokens).',
  },
];

function shouldAllowLine(line: string): boolean {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*')) return true;
  if (t.includes('process.env.') || t.includes('import.meta.env.')) return true;
  return false;
}

function walk(fullDir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(fullDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    const fp = path.join(fullDir, name);
    const relFromRoot = path.relative(ROOT, fp);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      if (SKIP_ROOT_DIRS.has(relFromRoot.split(path.sep)[0] ?? '')) continue;
      walk(fp, out);
      continue;
    }
    const ext = path.extname(name);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    if (ALLOW_FILES.has(fp)) continue;
    out.push(fp);
  }
}

function main(): void {
  const files: string[] = [];
  for (const name of fs.readdirSync(ROOT)) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    if (SKIP_ROOT_DIRS.has(name)) continue;
    const fp = path.join(ROOT, name);
    try {
      const st = fs.statSync(fp);
      if (st.isDirectory()) {
        walk(fp, files);
      } else if (st.isFile()) {
        const ext = path.extname(name);
        if (SCAN_EXTENSIONS.has(ext) && !ALLOW_FILES.has(fp)) {
          files.push(fp);
        }
      }
    } catch {
      /* ignore */
    }
  }

  type Hit = { file: string; line: number; rule: string; excerpt: string; hint: string };
  const hits: Hit[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (shouldAllowLine(line)) return;
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        if (rule.re.test(line)) {
          hits.push({
            file: path.relative(ROOT, file),
            line: idx + 1,
            rule: rule.id,
            excerpt: line.trim().slice(0, 200),
            hint: rule.hint,
          });
        }
      }
    });
  }

  if (hits.length === 0) {
    console.log(
      'check-env-security: OK (no hardcoded-secret patterns matched in scanned sources).'
    );
    process.exit(0);
    return;
  }

  console.error('check-env-security: FAILED — move secrets behind process.env / CI secrets.');
  const byKey = new Map<string, Hit>();
  for (const h of hits) {
    byKey.set(`${h.file}:${h.line}:${h.rule}`, h);
  }
  for (const h of byKey.values()) {
    console.error(`  ${h.file}:${h.line} [${h.rule}] ${h.hint}`);
    console.error(`    ${h.excerpt}`);
  }
  process.exit(1);
}

main();
