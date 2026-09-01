#!/usr/bin/env node

Promise.resolve(require("@zabarov/mirai").runCli(process.argv.slice(2))).then(
  (code) => { process.exitCode = typeof code === "number" ? code : 0; },
  (error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
);
