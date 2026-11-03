import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "./bundle.mjs";
import { VISUAL_TOKENS } from "../src/js/browser/visual-tokens.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = resolve(projectRoot, "src/html/index.template.html");
const cssPath = resolve(projectRoot, "src/css/main.css");
const jsPath = resolve(projectRoot, "src/js/main.js");
const outputPath = resolve(projectRoot, "dist/mind-mapper.html");

const [template, css, js] = await Promise.all([
  readFile(templatePath, "utf8"),
  readFile(cssPath, "utf8"),
  bundle(jsPath, resolve(projectRoot, "src/js")),
]);

function replaceExactlyOnce(source, marker, value) {
  const first = source.indexOf(marker);
  if (first < 0 || source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error("Expected exactly one " + marker + " marker in HTML template");
  }
  return source.slice(0, first) + value + source.slice(first + marker.length);
}

const tokenCss = ':root {\n' + Object.entries(VISUAL_TOKENS).map(([role, value]) =>
  `  --${role.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())}: ${value};`).join('\n') + '\n}';
const themedCss = replaceExactlyOnce(css, '/*__VISUAL_TOKENS__*/', tokenCss);
const html = replaceExactlyOnce(
  replaceExactlyOnce(template, "/*__APP_CSS__*/", themedCss.replace(/<\/style/gi, "<\\/style")),
  "/*__APP_JS__*/",
  js.replace(/<\/script/gi, "<\\/script"),
);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
process.stdout.write("Built " + outputPath + "\n");
