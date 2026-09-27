import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname, extname } from "node:path";

const root = resolvePath(dirname(fileURLToPath(import.meta.url)), "../..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  if (specifier.startsWith("@/")) {
    const path = resolvePath(root, specifier.slice(2));
    return { url: pathToFileURL(extname(path) ? path : `${path}.js`).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

