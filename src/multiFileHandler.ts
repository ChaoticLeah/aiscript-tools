import fs from 'fs';
import path from 'path';

const INCLUDE_REGEX = /^#include\s+<(.+?)>$/gm;

export function resolveIncludes(filePath: string, visited = new Set<string>()): string {
  if (visited.has(filePath)) {
    throw new Error(`Circular include detected: ${filePath}`);
  }
  visited.add(filePath);

  const dir = path.dirname(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  let result = '';

  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(INCLUDE_REGEX);
    if (match) {
      const includeFile = line.match(/<(.+)>/)?.[1];
      if (!includeFile) continue;

      const fullPath = path.resolve(dir, includeFile);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Included file not found: ${fullPath}`);
      }

      result += resolveIncludes(fullPath, visited) + '\n';
    } else {
      result += line + '\n';
    }
  }

  return result;
}
