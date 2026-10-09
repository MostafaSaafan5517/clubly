import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "@playwright/test";
import { demo, outDir, requireDemo, signedInPage } from "./support";

// Lighthouse scores for the pages the redesign must not make worse, at Lighthouse's mobile and
// desktop settings, against the production build this config serves. Each page is measured three
// times and the median kept, since a single run moves by several points. Written to
// <SCREENS_DIR>/lighthouse.json. Only with LIGHTHOUSE=1. With LIGHTHOUSE_SITE=<url> it measures
// that site's signed-out pages instead (the live demo, say) into lighthouse-site.json; it never
// signs in anywhere but the local app.

const site = process.env.LIGHTHOUSE_SITE;
const pages = [
  { name: "home", path: "/", signedInAs: null },
  { name: "join", path: `/b/${demo.slug}`, signedInAs: null },
  { name: "login", path: "/login", signedInAs: null },
  {
    name: "members",
    path: `/dashboard/b/${demo.slug}/members`,
    signedInAs: demo.owner,
  },
  {
    name: "revenue",
    path: `/dashboard/b/${demo.slug}/revenue`,
    signedInAs: demo.owner,
  },
  { name: "account", path: "/account", signedInAs: demo.member },
].filter((page) => !site || page.signedInAs === null);
const runs = 3;

type Report = {
  categories: Record<string, { score: number }>;
  audits: Record<string, { numericValue?: number }>;
};

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

test("lighthouse: public pages, the dashboard and the member's account", async ({
  browser,
}, testInfo) => {
  test.skip(!process.env.LIGHTHOUSE, "Set LIGHTHOUSE=1 to measure.");
  test.skip(testInfo.project.name !== "desktop", "Lighthouse sets its sizes.");
  test.setTimeout(60 * 60_000);
  const work = mkdtempSync(path.join(tmpdir(), "clubly-lighthouse-"));

  // Signed-in pages get the user's session cookies, from a file so they never appear in a
  // command line.
  const headerFiles = new Map<string, string>();
  if (!site) {
    await requireDemo();
    for (const email of new Set(pages.map((page) => page.signedInAs))) {
      if (!email) continue;
      const page = await signedInPage(browser, email, demo.password);
      const cookies = await page.context().cookies();
      await page.context().close();
      const file = path.join(work, `${email}.json`);
      writeFileSync(
        file,
        JSON.stringify({
          Cookie: cookies
            .map(({ name, value }) => `${name}=${value}`)
            .join("; "),
        }),
      );
      headerFiles.set(email, file);
    }
  }

  const baseURL = site ?? testInfo.project.use.baseURL!;
  const results: Record<string, Record<string, number>> = {};
  for (const page of pages) {
    for (const formFactor of ["mobile", "desktop"] as const) {
      const reports: Report[] = [];
      for (let run = 0; run < runs; run += 1) {
        const output = path.join(
          work,
          `${page.name}-${formFactor}-${run}.json`,
        );
        const headers = page.signedInAs && headerFiles.get(page.signedInAs);
        const lighthouse = spawnSync(
          "pnpm",
          [
            "dlx",
            "lighthouse@13.5.0",
            `${baseURL}${page.path}`,
            "--output=json",
            `--output-path=${output}`,
            "--quiet",
            "--chrome-flags=--headless=new",
            "--only-categories=performance,accessibility,best-practices,seo",
            ...(formFactor === "desktop" ? ["--preset=desktop"] : []),
            ...(headers ? [`--extra-headers=${headers}`] : []),
          ],
          { shell: true, encoding: "utf8", timeout: 180_000 },
        );
        if (lighthouse.status !== 0) {
          throw new Error(
            `Lighthouse failed on ${page.path}: ${lighthouse.stderr}`,
          );
        }
        reports.push(JSON.parse(readFileSync(output, "utf8")) as Report);
      }
      const score = (category: string) =>
        median(
          reports.map((report) =>
            Math.round(report.categories[category]!.score * 100),
          ),
        );
      const metric = (audit: string) =>
        median(
          reports.map((report) => report.audits[audit]?.numericValue ?? 0),
        );
      results[`${page.name}-${formFactor}`] = {
        performance: score("performance"),
        accessibility: score("accessibility"),
        bestPractices: score("best-practices"),
        seo: score("seo"),
        firstContentfulPaintMs: Math.round(metric("first-contentful-paint")),
        largestContentfulPaintMs: Math.round(
          metric("largest-contentful-paint"),
        ),
        totalBlockingTimeMs: Math.round(metric("total-blocking-time")),
        cumulativeLayoutShift: Number(
          metric("cumulative-layout-shift").toFixed(3),
        ),
      };
    }
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, site ? "lighthouse-site.json" : "lighthouse.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
});
