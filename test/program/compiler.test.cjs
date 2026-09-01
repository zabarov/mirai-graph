const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { compileProgramSource, compileProgramFile, ProgramCompilationError } = require("../../dist/cjs/program");

const fixture = path.resolve(__dirname, "../../examples/mirai-program-minimal/program.mirai.yaml");

test("compiler is deterministic across equivalent YAML formatting", () => {
  const source = fs.readFileSync(fixture, "utf8");
  const first = compileProgramSource(source, "first.mirai.yaml").program;
  const second = compileProgramSource(`\n${source}\n`, "second.mirai.yaml").program;
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.nodes, second.nodes);
});

test("compiled JSON verifies its digest", () => {
  const program = compileProgramFile(fixture).program;
  const reparsed = compileProgramSource(JSON.stringify(program), "program.mirai.json").program;
  assert.equal(reparsed.digest, program.digest);
});

test("tampered compiled JSON fails closed", () => {
  const program = compileProgramFile(fixture).program;
  program.version = "tampered";
  assert.throws(
    () => compileProgramSource(JSON.stringify(program), "program.mirai.json"),
    (error) => error instanceof ProgramCompilationError && error.validation.errors.some((item) => item.startsWith("digest_mismatch:"))
  );
});

test("unbounded foreach and unknown effects fail before execution", () => {
  for (const name of ["unbounded-foreach.mirai.yaml", "unknown-effect.mirai.yaml"]) {
    const invalid = path.resolve(__dirname, "../../examples/mirai-program-invalid", name);
    assert.throws(
      () => compileProgramFile(invalid),
      (error) => error instanceof ProgramCompilationError && error.validation.errors.length > 0
    );
  }
});

test("JSON duplicate members and unknown node fields fail closed", () => {
  assert.throws(() => compileProgramSource('{"contract_version":"1.0.0","id":"first","id":"second"}', "duplicate.mirai.json"), /Map keys must be unique|unique/);
  const program = compileProgramFile(fixture).program;
  delete program.digest;
  program.nodes[0].undeclared_runtime_switch = true;
  assert.throws(
    () => compileProgramSource(JSON.stringify(program), "unknown-field.mirai.json"),
    (error) => error instanceof ProgramCompilationError && error.validation.errors.some((item) => item.includes("unknown_field:undeclared_runtime_switch") || item.includes("additional properties"))
  );
});
