import { canonicalJson, digestValue } from "../core/canonical.js";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { TASK_PLAN_SCHEMA, TASK_POLICY_SCHEMA } from "./schema.js";
import { valueMatchesType } from "../program/validator.js";
import { assertSnapshot, lexical, projectAccessibleSnapshot, projectGraph, requireCondition, requireJson, seal } from "../stdlib/graph.js";
import { standardOperationCatalogDigest } from "../stdlib/catalog.js";
import type { GraphSnapshot } from "../stdlib/types.js";
import type { TaskPlan, TaskPolicy, TaskReceiver, TaskRequest } from "./types.js";

const idPattern = /^[A-Za-z][A-Za-z0-9_.:-]{0,159}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const planShape = ajv.compile(TASK_PLAN_SCHEMA);
const policyShape = ajv.compile(TASK_POLICY_SCHEMA);

export function taskReceiverCatalogDigest(receivers: TaskReceiver[]): string {
  requireCondition(Array.isArray(receivers) && receivers.length > 0 && receivers.length <= 256, "task_receivers_invalid");
  for (const receiver of receivers) {
    requireCondition(idPattern.test(receiver.id) && digestPattern.test(receiver.digest) && ["program", "ai"].includes(receiver.kind), "task_receiver_descriptor_invalid");
    requireJson({ input_type: receiver.input_type, output_type: receiver.output_type });
  }
  requireCondition(new Set(receivers.map(r => r.id)).size === receivers.length, "duplicate_task_receiver");
  return digestValue(receivers.map(r => ({ id: r.id, kind: r.kind, digest: r.digest, input_type: r.input_type, output_type: r.output_type })).sort((a, b) => lexical(a.id, b.id)));
}

export function createTaskPolicy(input: Omit<TaskPolicy, "digest">): TaskPolicy {
  requireJson(input);
  requireCondition(Object.keys(input).sort().join(",") === "id,max_depth,max_duration_ms,max_model_calls,max_output_bytes,max_parallel,max_tasks,owner,participants,reviewers", "task_policy_shape_invalid");
  requireCondition(idPattern.test(input.id) && idPattern.test(input.owner) && Array.isArray(input.reviewers) && input.reviewers.length > 0 && new Set(input.reviewers).size === input.reviewers.length && input.reviewers.every(x => idPattern.test(x)), "task_policy_identity_invalid");
  for (const [key, ceiling] of Object.entries({ max_depth: 8, max_tasks: 256, max_parallel: 16, max_duration_ms: 300000, max_output_bytes: 1000000 })) {
    const value = input[key as keyof typeof input] as number;
    requireCondition(Number.isSafeInteger(value) && value >= 1 && value <= ceiling, "task_policy_budget_invalid");
  }
  requireCondition(Number.isSafeInteger(input.max_model_calls) && input.max_model_calls >= 0 && input.max_model_calls <= input.max_tasks, "task_model_budget_invalid");
  requireCondition(new Set(input.participants.map(p => p.id)).size === input.participants.length, "duplicate_task_participant");
  for (const participant of input.participants) {
    requireCondition(Object.keys(participant).sort().join(",") === "delegate_to,id,object_ids,source_ids" && idPattern.test(participant.id), "task_participant_invalid");
    for (const list of [participant.object_ids, participant.source_ids, participant.delegate_to])
      requireCondition(Array.isArray(list) && new Set(list).size === list.length && list.every(x => typeof x === "string" && idPattern.test(x)), "task_scope_invalid");
  }
  requireCondition(input.participants.some(p => p.id === input.owner), "task_owner_missing");
  const value = structuredClone(input);
  value.reviewers.sort(lexical);
  value.participants.sort((a, b) => lexical(a.id, b.id));
  for (const p of value.participants) { p.object_ids.sort(lexical); p.source_ids.sort(lexical); p.delegate_to.sort(lexical); }
  const policy = seal(value);
  requireCondition(policyShape(policy), "task_policy_shape_invalid");
  return policy;
}

export function assertTaskPolicy(policy: TaskPolicy): void {
  const { digest, ...body } = policy;
  requireCondition(createTaskPolicy(body).digest === digest, "task_policy_digest_mismatch");
}

export function taskContextView(graph: GraphSnapshot, policy: TaskPolicy, request: TaskRequest, requests: TaskRequest[]) {
  const participants = new Map(policy.participants.map(p => [p.id, p]));
  const receiver = participants.get(request.receiver_id);
  requireCondition(receiver, "task_receiver_policy_missing");
  const byId = new Map(requests.map(r => [r.id, r]));
  const chain = [receiver];
  let current = request;
  const visited = new Set([current.id]);
  while (current.parent_id) {
    const parent = byId.get(current.parent_id);
    requireCondition(parent && !visited.has(parent.id), "task_parent_missing_or_cycle");
    visited.add(parent.id);
    const parentScope = participants.get(parent.receiver_id);
    requireCondition(parentScope && parentScope.delegate_to.includes(current.receiver_id), "task_delegation_not_allowed");
    requireCondition(current.object_ids.every(id => parent.object_ids.includes(id)), "task_parent_scope_exceeded");
    requireCondition(Date.parse(current.deadline) <= Date.parse(parent.deadline), "task_parent_deadline_exceeded");
    chain.push(parentScope);
    current = parent;
    requireCondition(visited.size - 1 <= policy.max_depth, "task_delegation_depth_exceeded");
  }
  const owner = participants.get(policy.owner)!;
  requireCondition(owner.delegate_to.includes(current.receiver_id), "task_owner_delegation_not_allowed");
  chain.push(owner);
  const allowedObjects = new Set(receiver.object_ids.filter(id => chain.every(p => p.object_ids.includes(id))));
  const allowedSources = new Set(receiver.source_ids.filter(id => chain.every(p => p.source_ids.includes(id))));
  requireCondition(request.object_ids.every(id => allowedObjects.has(id)), "task_object_scope_exceeded");
  const authorized = projectAccessibleSnapshot(graph, { object_ids: allowedObjects, source_ids: allowedSources });
  return projectGraph(authorized, request.object_ids);
}

export function prepareTaskPlan(id: string, graph: GraphSnapshot, policy: TaskPolicy, requests: TaskRequest[], receivers: TaskReceiver[]): TaskPlan {
  assertSnapshot(graph); assertTaskPolicy(policy); requireJson(requests);
  requireCondition(idPattern.test(id), "task_plan_id_invalid");
  requireCondition(Array.isArray(requests) && requests.length > 0 && requests.length <= policy.max_tasks, "task_count_budget_exceeded");
  requireCondition(new Set(requests.map(r => r.id)).size === requests.length, "duplicate_task_id");
  const registered = new Map(receivers.map(r => [r.id, r]));
  const byId = new Map(requests.map(r => [r.id, r]));
  taskReceiverCatalogDigest(receivers);
  for (const request of requests) {
    requireCondition(Object.keys(request).sort().join(",") === "deadline,dependencies,id,input,object_ids,outcome,parent_id,receiver_digest,receiver_id,required_evidence", "task_request_shape_invalid");
    requireCondition(idPattern.test(request.id) && idPattern.test(request.receiver_id) && (request.parent_id === null || idPattern.test(request.parent_id)), "task_identity_invalid");
    requireCondition(typeof request.outcome === "string" && request.outcome.trim().length > 0 && request.outcome.length <= 256, "task_outcome_required");
    requireCondition(typeof request.deadline === "string" && Number.isFinite(Date.parse(request.deadline)), "task_deadline_invalid");
    requireCondition(Array.isArray(request.object_ids) && new Set(request.object_ids).size === request.object_ids.length, "task_object_refs_invalid");
    requireCondition(Array.isArray(request.required_evidence) && request.required_evidence.length > 0 && new Set(request.required_evidence).size === request.required_evidence.length && request.required_evidence.every(x => idPattern.test(x)), "task_evidence_contract_required");
    const receiver = registered.get(request.receiver_id);
    requireCondition(receiver && digestPattern.test(receiver.digest) && receiver.digest === request.receiver_digest, "task_receiver_digest_mismatch");
    requireCondition(valueMatchesType(request.input, receiver.input_type), "task_input_type_mismatch");
    taskContextView(graph, policy, request, requests);
    requireCondition(Array.isArray(request.dependencies) && new Set(request.dependencies.map(d => d.task_id)).size === request.dependencies.length, "task_dependencies_invalid");
    for (const dependency of request.dependencies) {
      const previous = byId.get(dependency.task_id);
      requireCondition(previous && previous.id !== request.id && ["verified", "accepted"].includes(dependency.requires) && Object.keys(dependency).sort().join(",") === "requires,task_id", "task_dependency_invalid");
      requireCondition(previous.object_ids.every(id => request.object_ids.includes(id)), "task_dependency_context_leak");
      const previousView = taskContextView(graph, policy, previous, requests).graph;
      const nextView = taskContextView(graph, policy, request, requests).graph;
      requireCondition(previousView.sources.every(source => nextView.sources.some(next => next.id === source.id && next.digest === source.digest)), "task_dependency_source_leak");
      requireCondition(previousView.relations.every(relation => nextView.relations.some(next => canonicalJson(next) === canonicalJson(relation))), "task_dependency_relation_leak");
    }
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function walk(id: string): void {
    requireCondition(!visiting.has(id), "task_dependency_cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id)!.dependencies) walk(dep.task_id);
    visiting.delete(id); visited.add(id);
  }
  for (const id of byId.keys()) walk(id);
  const ordered = structuredClone(requests).sort((a, b) => lexical(a.id, b.id));
  for (const request of ordered) {
    request.object_ids.sort(lexical); request.required_evidence.sort(lexical); request.dependencies.sort((a, b) => lexical(a.task_id, b.task_id));
  }
  const plan = seal({ contract_version: "1.0.0" as const, id, graph_digest: graph.digest, policy_digest: policy.digest,
    catalog_digest: standardOperationCatalogDigest(), requests: ordered, canonical_write_allowed: false as const });
  requireCondition(planShape(plan), "task_plan_shape_invalid");
  return plan;
}

export function assertTaskPlan(plan: TaskPlan, graph: GraphSnapshot, policy: TaskPolicy, receivers: TaskReceiver[]): void {
  requireJson(plan);
  const expected = prepareTaskPlan(plan.id, graph, policy, plan.requests, receivers);
  requireCondition(canonicalJson(expected) === canonicalJson(plan), "task_plan_digest_or_binding_mismatch");
}
