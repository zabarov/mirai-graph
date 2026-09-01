import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ConfinedPathOptions {
  allow_missing?: boolean;
  label?: string;
}

export function assertNoSymlinkComponents(targetInput: string, allowMissing = false, label = "path"): string {
  const target = path.resolve(targetInput);
  const anchors = [process.cwd(), os.tmpdir(), os.homedir()].map((value) => path.resolve(value));
  const anchor = anchors
    .filter((value) => target === value || target.startsWith(`${value}${path.sep}`))
    .sort((left, right) => right.length - left.length)[0] || path.parse(target).root;
  const root = fs.realpathSync(anchor);
  const relative = path.relative(anchor, target);
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) {
      if (allowMissing) break;
      throw new Error(`${label}_missing:${targetInput}`);
    }
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`${label}_symlink_forbidden:${targetInput}`);
  }
  return path.resolve(root, relative);
}

export function resolveConfinedPath(rootInput: string, reference: string, options: ConfinedPathOptions = {}): string {
  const label = options.label || "path";
  if (!reference || path.isAbsolute(reference) || reference.includes("\u0000")) throw new Error(`${label}_unsafe:${reference}`);
  const requestedRoot = path.resolve(rootInput);
  if (fs.lstatSync(requestedRoot).isSymbolicLink()) throw new Error(`${label}_root_symlink_forbidden:${rootInput}`);
  const root = fs.realpathSync(requestedRoot);
  const target = path.resolve(root, reference);
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`${label}_outside_root:${reference}`);
  let cursor = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) {
      if (options.allow_missing === true) break;
      throw new Error(`${label}_missing:${reference}`);
    }
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`${label}_symlink_forbidden:${reference}`);
  }
  return target;
}
