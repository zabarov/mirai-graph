import fs from "node:fs";
import { describeStandardOperation, invokeStandardOperation, standardOperationCatalog } from "../stdlib/catalog.js";

function readBoundedJson(filename: string | undefined): unknown {
  if (!filename) throw new Error("input_file_required");
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const limit = 8 * 1024 * 1024;
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw new Error("operation_input_file_budget_exceeded");
    const buffer = Buffer.alloc(limit + 1);
    let size = 0, count = 0;
    while (size < buffer.length && (count = fs.readSync(fd, buffer, size, buffer.length - size, null)) > 0) size += count;
    if (size > limit) throw new Error("operation_input_file_budget_exceeded");
    return JSON.parse(buffer.subarray(0, size).toString("utf8"));
  } finally { fs.closeSync(fd); }
}

/** All commands emit to stdout. Saving a proposal is a separate explicit action. */
export function runGraphOperationsCli(args: string[]): number {
  const catalog = standardOperationCatalog();
  let result: unknown;
  if (args[0] === "stdlib") {
    if (args[1] === "list" && args.length === 2) result = catalog;
    else if (args[1] === "describe" && args.length === 3) result = describeStandardOperation(args[2]!);
    else throw new Error("usage: mirai stdlib list | describe <operation>");
  } else {
    if (args.length !== 3 || !["graph", "cluster", "component"].includes(args[0] || ""))
      throw new Error("usage: mirai graph|cluster|component <operation> <arguments.json>");
    result = invokeStandardOperation(`${args[0]}.${args[1]}`, readBoundedJson(args[2]), catalog.digest);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}
