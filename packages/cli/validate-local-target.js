#!/usr/bin/env node
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const t = require("../project-technology");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirai-local-target-"));
const repo = path.join(root, "ordinary folder");
const stateRoot = path.join(root, "host-a");
const selection = {kind:"local", target_id:"target.example.delivery", acceptance_ref:"decision.example.accepted"};
const write = (ref,value) => {const file=path.join(repo,ref);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,t.canonicalBytes(value));};
const read = ref => JSON.parse(fs.readFileSync(path.join(repo,ref)));
const objRef = id => `graph/specs/objects/${id}.json`;
const object = id => ({id,kind:"constraint",title:id,summary:"Bounded example",profile:"implementation_control",lifecycle:"accepted",readiness:"accepted",evidence:[]});
const snapshot = dir => {const out={}; function walk(at){for(const name of fs.readdirSync(at).sort()){const f=path.join(at,name);if(fs.statSync(f).isDirectory())walk(f);else out[path.relative(dir,f)]=t.sha256(fs.readFileSync(f));}} walk(dir);return out;};
const checks=[];
function check(id,fn){fn();checks.push({id,passed:true});}
let trust;
const options = () => ({stateRoot,localAcceptance:trust});
const binding = () => t.status(repo,options()).target_binding;
function mutate(ref,change,test){const before=fs.readFileSync(path.join(repo,ref)); const v=read(ref);change(v);write(ref,v);try{test();}finally{fs.writeFileSync(path.join(repo,ref),before);}}
try {
  write("graph.json",{$schema:"https://mirai-graph.dev/schemas/graph-manifest.schema.json",format:"mirai-graph",schema_version:"2.0.0",id:"project.example",aliases:[],title:"Ordinary folder",scope:"repository",kind:"project_graph",owner:"owner.example",profiles:["project_management","implementation_control"],imports:[],graph:{root:"graph",source_of_truth:["graph/specs"],objects:["graph/specs/index.json"],relations:["graph/specs/relations.json"],schemas:[],generated:["graph/generated"],raw_sources:["data"]},extensions:{"mirai.project_technology":{contract_version:"1.0.0",enabled:true,context_policy:"task_scoped",source_boundary:"hybrid_sot"}}});
  const contract={decision_refs:[selection.acceptance_ref],goal_binding:{goal_id:"goal.example",done_when_ids:["done.example"]},requirement_bindings:[{requirement_id:"requirement.example",acceptance_ids:["acceptance.example"],done_when_ids:["done.example"]}],constraint_ids:["constraint.example"],non_goal_ids:["non_goal.example"],deferred_boundary_ids:["deferred.example"],allowed_change_scope:[{repository_id:"project.example",owner_id:"owner.example",package_id:"package.example",file_patterns:["data/tools/**"],actions:["modify","test"]}],architecture_contract:{contract_ref:"contract.example",acceptance_ref:selection.acceptance_ref,architecture_owner_id:"human.example",lifecycle:"accepted",owner_ids:["owner.example"],component_ids:["component.example"],package_ids:["package.example"],capability_ids:["capability.example"],ownership_boundaries:[{subject_ref:"component.example",data_owner:"owner.example",access_owner:"owner.example",lifecycle_owner:"owner.example",interface_owner:"owner.example",runtime_owner:"owner.example"}],required_relations:[],allowed_relations:[],forbidden_relations:[],required_dependencies:[],forbidden_dependencies:[]}};
  const ids=[selection.target_id,selection.acceptance_ref,"goal.example","done.example","requirement.example","acceptance.example","constraint.example","non_goal.example","deferred.example","contract.example"];
  for(const id of ids)write(objRef(id),object(id));
  write("graph/specs/index.json",{object_files:ids.map(id=>`objects/${id}.json`)});
  write("graph/specs/relations.json",[]);
  fs.mkdirSync(path.join(repo,"data/tools"),{recursive:true});fs.writeFileSync(path.join(repo,"data/tools/method.txt"),"A bounded public method.\n");
  const target={...object(selection.target_id),kind:"contract",tz_role:"contract",provider_execution_contract:contract,source_refs:["data/tools/method.txt"]};
  write(objRef(selection.target_id),target);
  const candidate=t.plan(repo,{stateRoot,targetSource:selection}).target_binding;
  assert(candidate.semantic_digest);
  target.semantic_digest=candidate.semantic_digest;target.content_revision=candidate.content_revision;write(objRef(selection.target_id),target);
  const decision={...object(selection.acceptance_ref),kind:"decision",subtype:"architecture_baseline_acceptance",graph_id:"project.example",target_id:selection.target_id,owner_id:"human.example",semantic_digest:candidate.semantic_digest,execution_contract_digest:candidate.execution_contract_digest,approval_ref:"approval.example.owner"};
  write(objRef(selection.acceptance_ref),decision);
  // Synthetic authority fixture: independent trusted input is held outside
  // the project and frozen before tamper tests. Production must verify issuer.
  trust={graphId:"project.example",targetId:selection.target_id,ownerId:"human.example",decisionSha256:t.sha256(t.canonicalBytes(decision))};
  check("selection_preview_zero_write",()=>{const before=snapshot(root);const r=t.execute("sync",repo,{...options(),targetSource:selection});assert.equal(r.status,"preview");assert.equal(r.target_binding.status,"ready");assert.deepEqual(snapshot(root),before);});
  check("selection_requires_cas",()=>assert(t.execute("sync",repo,{...options(),apply:true,targetSource:selection}).blockers.includes("local_target_compare_and_swap_conflict")));
  check("ordinary_folder_selects_without_git",()=>{const r=t.execute("sync",repo,{...options(),apply:true,targetSource:selection,expectedGraphDigest:t.continuity.graphDigest(repo)});assert.equal(r.status,"success",JSON.stringify(r));assert.equal(r.changed,true);assert(!fs.existsSync(path.join(repo,".git")));});
  check("ready_exact_local_identity",()=>{assert.equal(binding().status,"ready",JSON.stringify(binding()));assert.equal(binding().source_kind,"local");assert.equal(binding().provider_revision,undefined);});
  check("status_plan_context_verify_agree_and_read_only",()=>{const before=snapshot(root);for(const op of ["status","plan","context","verify"]){const r=t.execute(op,repo,{...options(),significantWork:true,task:"Bounded example"});assert.equal(r.target_binding.status,"ready",JSON.stringify(r));}assert.deepEqual(snapshot(root),before);});
  check("asserted_accepted_is_not_trust",()=>assert(t.status(repo,{stateRoot}).target_binding.blockers.includes("local_target_acceptance_unverified")));
  check("two_hosts_same_target_identity",()=>assert.deepEqual(t.status(repo,{...options(),stateRoot:path.join(root,"host-b")}).target_binding,binding()));
  check("repeat_selection_byte_identical",()=>{const before=snapshot(root);const r=t.execute("sync",repo,{...options(),apply:true,targetSource:selection,expectedGraphDigest:t.continuity.graphDigest(repo)});assert.equal(r.changed,false);assert.deepEqual(snapshot(root),before);});
  for(const lifecycle of ["draft","reviewed","stale","deprecated","blocked"]){check(`reject_${lifecycle}`,()=>mutate(objRef(selection.target_id),v=>v.lifecycle=lifecycle,()=>assert.equal(binding().status,"blocked")));}
  check("unapproved_semantic_change",()=>mutate(objRef("requirement.example"),v=>v.summary="Different meaning",()=>assert(binding().blockers.includes("local_target_semantic_digest_mismatch"))));
  check("rehashed_decision_is_not_trusted",()=>mutate(objRef(selection.acceptance_ref),v=>v.approval_ref="approval.other",()=>assert(binding().blockers.includes("local_target_acceptance_unverified"))));
  check("foreign_owner",()=>mutate(objRef(selection.acceptance_ref),v=>v.owner_id="human.other",()=>assert(binding().blockers.includes("local_target_acceptance_identity_mismatch"))));
  for(const key of ["requirement_bindings","allowed_change_scope","non_goal_ids","constraint_ids","deferred_boundary_ids"]){check(`empty_${key}`,()=>mutate(objRef(selection.target_id),v=>v.provider_execution_contract[key]=[],()=>assert.equal(binding().status,"blocked")));}
  check("scope_owner_unapproved",()=>mutate(objRef(selection.target_id),v=>v.provider_execution_contract.allowed_change_scope[0].owner_id="owner.other",()=>assert(binding().blockers.includes("provider_contract_scope_owner_unapproved"))));
  check("duplicate_target",()=>mutate("graph/specs/index.json",v=>{write("graph/specs/duplicate.json",target);v.object_files.push("duplicate.json");},()=>assert(binding().blockers.includes("duplicate_object_id"))));
  fs.unlinkSync(path.join(repo,"graph/specs/duplicate.json"));
  check("required_cycle",()=>mutate("graph/specs/relations.json",v=>v.push({id:"relation.cycle",type:"requires",source:selection.target_id,target:selection.target_id,lifecycle:"accepted"}),()=>assert(binding().blockers.includes("local_target_required_cycle"))));
  check("private_path_rejected",()=>mutate(objRef(selection.target_id),v=>v.source_refs=["source/private/method.txt"],()=>assert(binding().blockers.includes("local_target_source_unsafe_or_missing"))));
  check("parent_traversal_rejected",()=>mutate(objRef(selection.target_id),v=>v.source_refs=["../outside.txt"],()=>assert(binding().blockers.includes("local_target_source_unsafe_or_missing"))));
  check("malformed_source_refs_fail_closed",()=>mutate(objRef(selection.target_id),v=>v.source_refs={ref:"data/tools/method.txt"},()=>assert(binding().blockers.includes("local_target_source_refs_invalid"))));
  check("tool_drift_not_semantic_acceptance",()=>{const file=path.join(repo,"data/tools/method.txt");const before=fs.readFileSync(file);fs.writeFileSync(file,"Changed tool\n");try{const b=binding();assert(b.blockers.includes("local_target_content_stale"));assert(!b.blockers.includes("local_target_semantic_digest_mismatch"));}finally{fs.writeFileSync(file,before);}});
  check("external_binding_never_falls_back",()=>{const file=path.join(t.continuity.stateRoot(repo,read("graph.json"),options()),"target-provider-binding.json");fs.writeFileSync(file,"{}");try{assert(binding().blockers.includes("local_external_target_conflict"));}finally{fs.unlinkSync(file);}});
  check("disabled_blocks_significant_verify",()=>mutate("graph.json",v=>v.extensions["mirai.project_technology"].enabled=false,()=>assert(t.verify(repo,{...options(),significantWork:true}).blockers.includes("project_technology_disabled"))));
  check("shared_lease_conflict_preserves_bytes",()=>{const file=path.join(repo,"graph/.project-technology-continuity.lock");fs.writeFileSync(file,"occupied");const before=snapshot(root);try{assert(t.execute("sync",repo,{...options(),apply:true,targetSource:selection,expectedGraphDigest:t.continuity.graphDigest(repo)}).blockers.includes("continuity_lease_conflict"));assert.deepEqual(snapshot(root),before);}finally{fs.unlinkSync(file);}});
  check("offline_stale_cas_blocks",()=>assert(t.execute("sync",repo,{...options(),apply:true,targetSource:selection,expectedGraphDigest:"sha256:"+"0".repeat(64)}).blockers.includes("local_target_compare_and_swap_conflict")));
  check("selection_failure_rolls_back_project",()=>{
    const manifest=read("graph.json");const unselected=structuredClone(manifest);delete unselected.extensions["mirai.project_technology"].target_source;write("graph.json",unselected);
    const before=snapshot(repo);const rename=fs.renameSync;let injected=false;
    fs.renameSync=(from,to)=>{const result=rename(from,to);if(!injected&&String(to)===path.join(repo,"graph.json")){injected=true;throw new Error("fixture failure after manifest rename");}return result;};
    try{const r=t.execute("sync",repo,{...options(),apply:true,targetSource:selection,expectedGraphDigest:t.continuity.graphDigest(repo)});assert(r.blockers.includes("local_target_rollback_applied"),JSON.stringify(r));assert.deepEqual(snapshot(repo),before);}finally{fs.renameSync=rename;write("graph.json",manifest);}
  });
  check("cli_local_trust_and_plan",()=>{
    const file=path.join(root,"owner-trust.json");fs.writeFileSync(file,JSON.stringify(trust));
    const r=spawnSync(process.execPath,[path.join(__dirname,"project-technology.js"),"plan",repo,"--local-acceptance-trust",file,"--state-root",stateRoot],{encoding:"utf8"});
    assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).target_binding.status,"ready");
  });
  check("missing_verification_blocks_execution_not_diagnostics",()=>{
    assert(t.verify(repo,{...options(),significantWork:true}).blockers.includes("local_target_verification_missing"));
    assert(t.context(repo,{...options(),significantWork:true,task:"Bounded example"}).blockers.includes("local_target_verification_missing"));
    assert.equal(t.plan(repo,options()).target_binding.status,"ready");
  });
  const evidence={task_digest:t.sha256("verified local fixture",true),outcome:"Verified bounded local method",requirement_refs:["requirement.example"],evidence_refs:["data/tools/method.txt"],checks:[{id:"check.example",verdict:"pass",evidence_ref:"data/tools/method.txt"}],changed_surfaces:["data/tools/method.txt"]};
  check("verified_boundary_unlocks_significant_verify",()=>{
    const r=t.execute("sync",repo,{...options(),apply:true,boundary:"stage_complete",continuityEvidence:evidence,expectedGraphDigest:t.continuity.graphDigest(repo)});
    assert.equal(r.status,"success",JSON.stringify(r));
    const v=t.verify(repo,{...options(),significantWork:true});assert.equal(v.status,"success",JSON.stringify(v));
  });
  check("repointing_content_pin_does_not_refresh_verification",()=>{
    const file=path.join(repo,"data/tools/method.txt");const before=fs.readFileSync(file);fs.writeFileSync(file,"A newly checked method needs fresh evidence.\n");
    try{mutate(objRef(selection.target_id),v=>v.content_revision=binding().content_revision,()=>{
      assert.equal(binding().status,"ready");
      assert(t.verify(repo,{...options(),significantWork:true}).blockers.includes("local_target_verification_stale"));
    });}finally{fs.writeFileSync(file,before);}
  });
  check("two_hosts_same_context_discovery_digest",()=>{
    const a=t.context(repo,{...options(),task:"Bounded example"});const b=t.context(repo,{...options(),stateRoot:path.join(root,"host-b"),task:"Bounded example"});
    assert.deepEqual(a.traversal_receipt,b.traversal_receipt);
    assert(t.verify(repo,{...options(),stateRoot:path.join(root,"host-b"),significantWork:true}).blockers.includes("local_target_verification_missing"));
  });
  // Optional synthetic fixture for consumer integration tests; never real data.
  if(process.env.MIRAI_LOCAL_TARGET_FIXTURE_EXPORT){
    const output=path.resolve(process.env.MIRAI_LOCAL_TARGET_FIXTURE_EXPORT);
    fs.mkdirSync(output,{recursive:true});
    for(const name of ["project","state","owner-trust.json"])assert(!fs.existsSync(path.join(output,name)),"fixture destination must be empty");
    fs.cpSync(repo,path.join(output,"project"),{recursive:true});fs.cpSync(stateRoot,path.join(output,"state"),{recursive:true});
    fs.writeFileSync(path.join(output,"owner-trust.json"),t.canonicalBytes(trust));
  }
  check("local_disconnect_transaction_and_repeat",()=>{
    const r=t.execute("disconnect",repo,{...options(),apply:true,expectedGraphDigest:t.continuity.graphDigest(repo)});
    assert.equal(r.status,"success",JSON.stringify(r));assert.equal(r.changed,true);assert.equal(binding().status,"not_configured");assert(r.rollback_ref);
    const before=snapshot(root);assert.equal(t.execute("disconnect",repo,{...options(),apply:true}).changed,false);assert.deepEqual(snapshot(root),before);
    assert.equal(t.execute("sync",repo,{...options(),apply:true,targetSource:selection,expectedGraphDigest:t.continuity.graphDigest(repo)}).status,"success");
  });
  check("git_equivalent_identity",()=>{const before=binding();for(const args of [["init","-q"],["config","user.name","Fixture"],["config","user.email","fixture@example.invalid"],["add","."],["commit","-qm","accepted fixture"]])assert.equal(spawnSync("git",args,{cwd:repo}).status,0);assert.deepEqual(binding(),before);});
  console.log(JSON.stringify({status:"success",checks_passed:checks.length,checks},null,2));
} finally {fs.rmSync(root,{recursive:true,force:true});}
