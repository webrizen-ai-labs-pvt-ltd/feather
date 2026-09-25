import { pathToFileURL } from 'node:url';
import path from 'node:path';

const srcUrl = pathToFileURL(path.join(import.meta.dirname, 'src') + path.sep).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(new URL(specifier.slice(2), srcUrl).href, context);
  }
  return nextResolve(specifier, context);
}
