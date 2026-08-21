#!/usr/bin/env node
// Enforces a first-load JS/CSS budget per route. Reads the real
// .next/app-build-manifest.json (not a guess at what webpack produced),
// gzips each referenced static file, and sums the unique files needed
// for a route's layout + page. Run after `next build`.

import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '..');
const nextDir = join(webRoot, '.next');
const manifestPath = join(nextDir, 'app-build-manifest.json');

if (!existsSync(manifestPath)) {
  console.error(
    `Bundle budget check: ${manifestPath} not found. Run "next build" first.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

/**
 * Routes to budget, in KB of gzipped first-load JS+CSS. Calibrated with
 * ~15% headroom above the measured baseline at the time these budgets
 * were set (2026-08-21): /page 201.6 KB, /dev/ui/page 209.7 KB. Tighten
 * these once real product pages replace the placeholder / and the
 * kitchen-sink /dev/ui gallery.
 */
const BUDGETS_KB = {
  '/page': 230,
  '/dev/ui/page': 240,
};

function gzipSizeKb(relativePath) {
  const absolutePath = join(nextDir, relativePath);
  const bytes = readFileSync(absolutePath);
  return gzipSync(bytes).length / 1024;
}

function firstLoadSizeKb(routeKey) {
  const routeFiles = manifest.pages[routeKey];
  if (!routeFiles) {
    throw new Error(`Route not found in app-build-manifest.json: ${routeKey}`);
  }
  const layoutFiles = manifest.pages['/layout'] ?? [];
  const uniqueFiles = new Set([...layoutFiles, ...routeFiles]);
  let totalKb = 0;
  for (const file of uniqueFiles) {
    totalKb += gzipSizeKb(file);
  }
  return totalKb;
}

let failed = false;

for (const [routeKey, budgetKb] of Object.entries(BUDGETS_KB)) {
  const actualKb = firstLoadSizeKb(routeKey);
  const status = actualKb <= budgetKb ? 'OK' : 'OVER BUDGET';
  if (actualKb > budgetKb) {
    failed = true;
  }
  console.log(
    `[${status}] ${routeKey}: ${actualKb.toFixed(1)} KB (budget: ${budgetKb} KB)`,
  );
}

if (failed) {
  console.error('\nBundle budget exceeded — see routes marked OVER BUDGET above.');
  process.exit(1);
}
