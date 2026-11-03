import { readFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep } from 'node:path';
import { Script } from 'node:vm';

// Deliberately limited to this project's named ESM imports/exports. Unsupported
// syntax fails the build; no runtime module fetches or eval are introduced.
export async function bundle(entry, root) {
  const modules = new Map(), visiting = new Set();
  const idFor = (path) => relative(root, path).split(sep).join('/');
  async function visit(path) {
    const id = idFor(path);
    if (id.startsWith('../')) throw new Error('Module escapes source root: ' + id);
    if (modules.has(id)) return;
    if (visiting.has(id)) throw new Error('Circular module dependency: ' + id);
    visiting.add(id);
    let source = await readFile(path, 'utf8');
    const exports = new Set();
    const pattern = /^(import|export)\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm;
    const matches = Array.from(source.matchAll(pattern));
    for (const match of matches) {
      if (!match[3].startsWith('.')) throw new Error('Only local modules are supported');
      const dependency = resolve(dirname(path), match[3]);
      await visit(dependency);
      const names = match[2].split(',').map((name) => name.trim()).filter(Boolean);
      if (names.some((name) => !/^[A-Za-z_$][\w$]*$/.test(name))) throw new Error('Unsupported import/export binding');
      const replacement = match[1] === 'import'
        ? `const { ${names.join(', ')} } = modules[${JSON.stringify(idFor(dependency))}];`
        : names.map((name) => `exports.${name} = modules[${JSON.stringify(idFor(dependency))}].${name};`).join('\n');
      source = source.replace(match[0], replacement);
    }
    source = source.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
      exports.add(name); return `${kind} ${name}`;
    });
    if (/^\s*(import|export)\s/m.test(source)) throw new Error('Unsupported module syntax in ' + id);
    source += '\n' + Array.from(exports).map((name) => `exports.${name} = ${name};`).join('\n');
    modules.set(id, source); visiting.delete(id);
  }
  await visit(entry);
  const result = '(() => {\n"use strict";\nconst modules = Object.create(null);\n' + Array.from(modules, ([id, source]) =>
    `modules[${JSON.stringify(id)}] = (() => { const exports = Object.create(null);\n${source}\nreturn exports; })();`).join('\n') + '\n})();\n';
  new Script(result);
  return result;
}
