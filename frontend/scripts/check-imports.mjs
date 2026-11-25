// Extensionless component/helper imports can resolve differently on macOS.
import {readdir, readFile} from 'node:fs/promises';
import {dirname, extname, resolve, basename, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const extensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.mts', '.json']);
export async function checkImports(root) {
  const files = [], issues = [], directories = new Map();
  async function walk(directory) {
    for (const entry of await readdir(directory, {withFileTypes:true})) {
      if (entry.isDirectory()) await walk(join(directory, entry.name));
      else if (['.js','.jsx','.mjs','.ts','.tsx','.mts'].includes(extname(entry.name))) files.push(join(directory, entry.name));
    }
  }
  await walk(root);
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const imports = text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])(\.[^'"]+)\1/g);
    for (const match of imports) {
      const specifier = match[2];
      if (extname(specifier) || specifier.includes('?')) continue;
      const target = resolve(dirname(file), specifier), directory = dirname(target);
      if (!directories.has(directory)) directories.set(directory, await readdir(directory).catch(() => []));
      const candidates = directories.get(directory).filter(name => extensions.has(extname(name)) && basename(name, extname(name)).toLowerCase() === basename(target).toLowerCase());
      if (candidates.length > 1) issues.push({file, specifier, candidates, line:text.slice(0, match.index).split('\n').length});
    }
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = await checkImports(fileURLToPath(new URL('../src/', import.meta.url)));
  for (const issue of issues) console.error(`${issue.file}:${issue.line}: укажите расширение импорта ${issue.specifier}; совпадающие имена: ${issue.candidates.join(', ')}`);
  if (!issues.length) console.log('Импорты компонентов и модулей: неоднозначных путей нет.');
  process.exitCode = issues.length ? 1 : 0;
}
