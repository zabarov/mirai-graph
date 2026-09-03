const { digestValue } = require("../../dist/cjs/core");
const { createGraphSnapshot } = require("../../dist/cjs/stdlib");

function relation(id, from, to, extras = {}) {
  return { contract_version: "1.0.0", id, type: "depends_on",
    participants: [{ ref: from, role: "consumer" }, { ref: to, role: "dependency" }],
    priority: 0, authority: "derived", confidence: 1,
    provenance: [{ source_ref: "source.shared" }], scope: "client.a", ...extras };
}

function fixtureInput() {
  function object(id, client, topics, source = "source.shared") {
    return { id, kind: "requirement", scope: `client.${client}`,
      metadata: { client, topics }, source_refs: [source] };
  }
  return { contract_version: "1.0.0", id: "demo.organization", canonical_write_allowed: false,
    sources: [
      { id: "source.shared", owner_ref: "owner.demo", digest: digestValue("shared"), confidentiality: "public" },
      { id: "source.private", owner_ref: "owner.private", digest: digestValue("private"), confidentiality: "restricted" }
    ],
    objects: [
      object("requirements.a", "a", ["requirements", "safety"]),
      object("verification.a", "a", ["verification"]),
      object("safety.a", "a", ["safety"]),
      object("verification.b", "b", ["verification"]),
      object("private.a", "a", ["safety"], "source.private"),
      { id: "unclassified", kind: "note", scope: "client.a", metadata: {}, source_refs: ["source.shared"] }
    ],
    relations: [
      relation("edge.verify", "verification.a", "requirements.a"),
      relation("edge.safety", "requirements.a", "safety.a"),
      relation("edge.private", "safety.a", "private.a"),
      relation("edge.expired", "verification.a", "safety.a", { valid_until: "2020-01-01T00:00:00Z" }),
      relation("edge.other", "verification.a", "verification.b", { scope: "client.b" })
    ] };
}

const oracle = Object.freeze({
  accessible: ["requirements.a", "safety.a", "unclassified", "verification.a", "verification.b"],
  scope_a: ["requirements.a", "safety.a", "unclassified", "verification.a"],
  traversal: ["requirements.a", "safety.a", "verification.a"],
  groups: {
    "client.a/requirements": ["requirements.a"],
    "client.a/safety": ["requirements.a", "safety.a"],
    "client.a/verification": ["verification.a"],
    "client.b/verification": ["verification.b"]
  },
  unassigned: ["unclassified"],
  multiply_assigned: ["requirements.a"],
  required_outcomes: ["requirements_checked", "verification_checked", "safety_checked"]
});

module.exports = { fixtureInput, snapshot: () => createGraphSnapshot(fixtureInput()), relation, oracle };
