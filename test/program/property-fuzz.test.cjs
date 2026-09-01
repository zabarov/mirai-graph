const assert = require("node:assert/strict");
const test = require("node:test");

const { canonicalJson, digestValue } = require("../../dist/cjs/core");
const {
  compileProgramFile,
  programDigest,
  validateProgram
} = require("../../dist/cjs/program");
const { evaluateExpression } = require("../../dist/cjs/runtime");

function generator(seed = 0x4d495241) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function randomJson(next, depth = 0) {
  const kind = depth >= 3 ? Math.floor(next() * 4) : Math.floor(next() * 6);
  if (kind === 0) return null;
  if (kind === 1) return next() > 0.5;
  if (kind === 2) return Math.floor(next() * 2_000_001) - 1_000_000;
  if (kind === 3) return `value-${Math.floor(next() * 1_000_000)}`;
  if (kind === 4) {
    return Array.from({ length: Math.floor(next() * 5) }, () => randomJson(next, depth + 1));
  }
  const result = {};
  for (let index = 0; index < Math.floor(next() * 5); index += 1) {
    result[`key-${Math.floor(next() * 1000)}-${index}`] = randomJson(next, depth + 1);
  }
  return result;
}

function reorder(value, next) {
  if (Array.isArray(value)) return value.map((item) => reorder(item, next));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value).map(([key, item]) => [key, reorder(item, next)]);
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const target = Math.floor(next() * (index + 1));
    [entries[index], entries[target]] = [entries[target], entries[index]];
  }
  return Object.fromEntries(entries);
}

test("canonical JSON and digest are invariant under generated object-key order", () => {
  const source = generator();
  const shuffle = generator(0x32544f53);
  for (let index = 0; index < 250; index += 1) {
    const value = randomJson(source);
    const reordered = reorder(value, shuffle);
    assert.equal(canonicalJson(reordered), canonicalJson(value), `canonical mismatch at case ${index}`);
    assert.equal(digestValue(reordered), digestValue(value), `digest mismatch at case ${index}`);
  }
});

test("generated program mutations fail static validation before execution", () => {
  const { program: baseline } = compileProgramFile("examples/mirai-program-minimal/program.mirai.yaml");
  assert.equal(validateProgram(baseline).valid, true);

  for (let index = 0; index < 100; index += 1) {
    const unknownNode = structuredClone(baseline);
    unknownNode.nodes[0].kind = `unknown_${index}`;
    const nodeResult = validateProgram(unknownNode, { verifyDigest: false });
    assert.equal(nodeResult.valid, false);
    assert(nodeResult.errors.some((error) => error.includes("unknown_kind") || error.includes("must be equal to one of the allowed values")));

    const unknownEffect = structuredClone(baseline);
    unknownEffect.policies.allowed_effects = [`unknown_effect_${index}`];
    const effectResult = validateProgram(unknownEffect, { verifyDigest: false });
    assert.equal(effectResult.valid, false);
    assert(effectResult.errors.some((error) => error.includes("unknown_allowed_effect")));
  }

  const tampered = structuredClone(baseline);
  tampered.version = "9.9.9";
  assert.notEqual(programDigest(tampered), baseline.digest);
  assert(validateProgram(tampered).errors.some((error) => error.startsWith("digest_mismatch:")));
});

test("expression evaluation rejects generated operators and inherited-property traversal", () => {
  const scope = { input: { own: "value" }, state: {}, local: {} };
  for (let index = 0; index < 100; index += 1) {
    assert.throws(
      () => evaluateExpression({ op: `eval_${index}`, left: { op: "literal", value: 1 }, right: { op: "literal", value: 1 } }, scope),
      /Unsupported expression/
    );
  }
  assert.throws(() => evaluateExpression({ op: "ref", path: "input.__proto__" }, scope), /Unknown reference path/);
  assert.throws(
    () => evaluateExpression({ op: "get", target: { op: "literal", value: {} }, key: "constructor" }, scope),
    /Missing key/
  );
  assert.equal(evaluateExpression({
    op: "in",
    left: { op: "literal", value: "constructor" },
    right: { op: "literal", value: {} }
  }, scope), false);
});
