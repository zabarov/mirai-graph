import fs from "node:fs";
import path from "node:path";
import { resolveConfinedPath } from "../core/path-boundary.js";

export const PROJECT_UPDATE_PENDING = ".mirai/project-update.pending.json";

// lstat also detects dangling links, which existsSync intentionally follows.
export function projectUpdatePath(root: string, ref: string): string {
  if (!ref || ref.includes("\\") || ref.split("/").some((p) => !p || p === "." || p === "..")) throw new Error("project_update_path_invalid");
  const target = resolveConfinedPath(root, ref, { allow_missing: true, label: "project_update" });
  let cursor = fs.realpathSync(root);
  for (const part of ref.split("/")) {
    cursor = path.join(cursor, part);
    try {
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) throw new Error("project_update_symlink_forbidden");
      if (cursor !== target && !stat.isDirectory()) throw new Error("project_update_parent_not_directory");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}

export function assertNoPendingProjectUpdate(root: string): void {
  const pending = projectUpdatePath(root, PROJECT_UPDATE_PENDING);
  if (fs.existsSync(pending)) throw new Error("project_update_pending_recovery_required");
}
