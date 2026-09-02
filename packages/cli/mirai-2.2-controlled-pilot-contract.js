"use strict";

const INDEPENDENT_REVIEW = "pending";
const OWNER_DECISION = "ai_assisted_independent_review_may_substitute_for_human_review_for_this_release";
const CLAIM_BOUNDARY = "This controlled observe/suggest evidence is not external human peer review, release authorization, production-write authorization, proof of extraction correctness or authority for canonical update.";
const LIMITATIONS = [
  "Three source sets are private and represented only by sanitized aggregates and digests.",
  "Private source authenticity is owner-verifiable but not independently reproducible from this public artifact.",
  "Observe/suggest results do not establish correctness of extracted knowledge or discovered processes.",
  "No production effect, canonical merge or automatic technology promotion was performed.",
  "Owner-authorized AI-assisted review is not external human peer review."
];

module.exports = {
  CLAIM_BOUNDARY,
  INDEPENDENT_REVIEW,
  LIMITATIONS,
  OWNER_DECISION
};
