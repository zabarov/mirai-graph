const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const Ajv2020 = require("ajv/dist/2020").default;

const { compileProgramFile } = require("../../dist/cjs/program");
const { executePure } = require("../../dist/cjs/runtime");
const { runPureCorpus } = require("../../dist/cjs/conformance");

function schema(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../schemas", name), "utf8"));
}

test("pure language corpus passes with deterministic repetitions", async () => {
  const result = await runPureCorpus(path.resolve(__dirname, "../../conformance/corpus/pure/corpus.json"));
  assert.equal(result.status, "passed");
  assert.equal(result.failed, 0);
  assert(result.passed >= 5);
  assert(result.cases.some((item) => item.status === "expected_validation_failure"));
});

test("public pure episode and conformance result schemas accept reference output", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const corpusSchema = schema("mirai-conformance-corpus.schema.json");
  const episodeSchema = schema("mirai-pure-episode.schema.json");
  const resultSchema = schema("mirai-conformance-result.schema.json");
  const validateCorpus = ajv.compile(corpusSchema);
  const validateEpisode = ajv.compile(episodeSchema);
  const validateResult = ajv.compile(resultSchema);
  const corpus = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../conformance/corpus/pure/corpus.json"), "utf8"));
  const program = compileProgramFile(path.resolve(__dirname, "../../examples/mirai-program-minimal/program.mirai.yaml")).program;
  const episode = await executePure(program, { approved: true });
  const result = await runPureCorpus(path.resolve(__dirname, "../../conformance/corpus/pure/corpus.json"));
  assert.equal(validateCorpus(corpus), true, JSON.stringify(validateCorpus.errors));
  assert.equal(validateEpisode(episode), true, JSON.stringify(validateEpisode.errors));
  assert.equal(validateResult(result), true, JSON.stringify(validateResult.errors));
});
