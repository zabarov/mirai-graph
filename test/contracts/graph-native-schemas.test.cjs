const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;

const { scanSource, assimilateCatalog } = require("../../dist/cjs/assimilation");
const { resolveActivationPlan, runActivationPlan } = require("../../dist/cjs/activation");

test("public CommonJS subpath exports expose graph-native contracts", () => {
  assert.equal(typeof require("@zabarov/mirai/assimilation").scanSource, "function");
  assert.equal(typeof require("@zabarov/mirai/components").validateComponentPackage, "function");
  assert.equal(typeof require("@zabarov/mirai/activation").resolveActivationPlan, "function");
});

function validate(schemaName, value) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", schemaName), "utf8"));
  const validator = ajv.compile(schema);
  assert.equal(validator(value), true, JSON.stringify(validator.errors));
}

test("graph-native public schemas accept reference artifacts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-schema-"));
  try {
    fs.writeFileSync(path.join(root, "source.md"), "# Source\n");
    const catalog = scanSource(root);
    validate("source-catalog.schema.json", catalog);
    validate("assimilation-proposal.schema.json", assimilateCatalog(catalog));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  const components = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-components-minimal/component-package.json"), "utf8"));
  validate("component-package.schema.json", components);
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/graph-snapshot.json"), "utf8"));
  validate("relation-fact.schema.json", snapshot.relation_facts[0]);
  const draft = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-technology-draft-minimal/technology-draft.json"), "utf8"));
  validate("technology-draft.schema.json", draft);
  const signal = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/signal.json"), "utf8"));
  validate("activation-plan.schema.json", resolveActivationPlan(snapshot, signal));
});

test("activation run results conform to the public evidence schema", async () => {
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/graph-snapshot.json"), "utf8"));
  const signal = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../examples/mirai-activation-minimal/signal.json"), "utf8"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-run-schema-"));
  const result = await runActivationPlan(resolveActivationPlan(snapshot, signal), {
    base_dir: path.resolve(__dirname, "../.."),
    sandbox: path.join(root, "sandbox"),
    home: path.join(root, "home")
  });
  validate("activation-run-result.schema.json", result);
});
