const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;

const { compileProgramFile, MIRAI_PROGRAM_SCHEMA } = require("../../dist/cjs/program");

function schema(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", name), "utf8"));
}

test("public Program and migration schemas compile", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const programSchema = schema("mirai-program.schema.json");
  ajv.addSchema(programSchema);
  ajv.addSchema(schema("mirai-program-extension.schema.json"));
  ajv.addSchema(schema("mirai-migration-result.schema.json"));
  const validate = ajv.getSchema(programSchema.$id);
  const program = compileProgramFile(path.resolve(__dirname, "../../examples/mirai-program-minimal/program.mirai.yaml")).program;
  assert.equal(validate(program), true, JSON.stringify(validate.errors));
});

test("runtime and public Program schemas are identical", () => {
  const publicSchema = schema("mirai-program.schema.json");
  assert.deepEqual(MIRAI_PROGRAM_SCHEMA, publicSchema);
});

test("manifest extension cannot authorize a canonical write", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const extension = schema("mirai-program-extension.schema.json");
  const validate = ajv.compile(extension);
  assert.equal(validate({
    contract_version: "1.0.0",
    programs: [{ id: "program.example", source: "programs/example.mirai.yaml" }],
    canonical_write_allowed: true
  }), false);
});
