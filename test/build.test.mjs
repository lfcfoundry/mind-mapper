import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { Script } from "node:vm";
import { VISUAL_TOKENS } from "../src/js/browser/visual-tokens.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "dist/mind-mapper.html");

test("source structure and deterministic self-contained HTML build", async () => {
  const requiredSources = [
    "src/html/index.template.html",
    "src/css/main.css",
    "src/js/main.js",
    "scripts/build.mjs",
  ];
  for (const relativePath of requiredSources) {
    await access(resolve(projectRoot, relativePath));
  }

  const build = () => execFileSync(process.execPath, ["scripts/build.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  build();
  const first = await readFile(outputPath);
  build();
  const second = await readFile(outputPath);

  assert.deepEqual(second, first, "identical sources must produce identical bytes");
  assert.equal(
    createHash("sha256").update(first).digest("hex"),
    createHash("sha256").update(second).digest("hex"),
  );

  const html = first.toString("utf8");
  assert.match(html, /<style>[\s\S]*<\/style>/);
  assert.match(html, /<script>[\s\S]*<\/script>/);
  assert.match(html, /Mind Mapper/);
  assert.match(html, /id="map"/);
  assert.match(html, /id="outline"/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(script));
  const verifier = await readFile(resolve(projectRoot, 'test/browser-check.html'), 'utf8');
  assert.doesNotThrow(() => new Script(verifier.match(/<script>([\s\S]*?)<\/script>/)[1]));
  assert.match(script, /createCommandHistory/);
  assert.match(script, /layoutDocument/);
  assert.doesNotMatch(script, /^\s*(import|export)\s/m);
  for (const [role, value] of Object.entries(VISUAL_TOKENS)) {
    const property = role.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
    assert.ok(html.includes(`--${property}: ${value};`), `embedded shared token ${role}`);
  }
  assert.ok(!html.includes('__VISUAL_TOKENS__'));
  assert.ok(!html.includes("__APP_CSS__"));
  assert.ok(!html.includes("__APP_JS__"));
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b[^>]*>/i);
  assert.doesNotMatch(html, /@font-face|@import\s|url\(/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /\bimport\s*\(/i);
});
