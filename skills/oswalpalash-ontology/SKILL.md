Entity: { id, type, properties, relations, created, updated }
Relation: { from_id, relation_type, to_id, properties }

# Agents & People
Person: { name, email?, phone?, notes? }
Organization: { name, type?, members[] }

# Work
Project: { name, status, goals[], owner? }
Task: { title, status, due?, priority?, assignee?, blockers[] }
Goal: { description, target_date?, metrics[] }

# Time & Place
Event: { title, start, end?, location?, attendees[], recurrence? }
Location: { name, address?, coordinates? }

# Information
Document: { title, path?, url?, summary? }
Message: { content, sender, recipients[], thread? }
Thread: { subject, participants[], messages[] }
Note: { content, tags[], refs[] }

# Resources
Account: { service, username, credential_ref? }
Device: { name, type, identifiers[] }
Credential: { service, secret_ref }  # Never store secrets directly

# Meta
Action: { type, target, timestamp, outcome? }
Policy: { scope, rule, enforcement }

{"op":"create","entity":{"id":"p_001","type":"Person","properties":{"name":"Alice"}}}
{"op":"create","entity":{"id":"proj_001","type":"Project","properties":{"name":"Website Redesign","status":"active"}}}
{"op":"relate","from":"proj_001","rel":"has_owner","to":"p_001"}

python3 scripts/ontology.py create --type Person --props &#x27;{"name":"Alice","email":"alice@example.com"}&#x27;

python3 scripts/ontology.py query --type Task --where &#x27;{"status":"open"}&#x27;
python3 scripts/ontology.py get --id task_001
python3 scripts/ontology.py related --id proj_001 --rel has_task

python3 scripts/ontology.py relate --from proj_001 --rel has_task --to task_001

python3 scripts/ontology.py validate  # Check all constraints

types:
  Task:
    required: [title, status]
    status_enum: [open, in_progress, blocked, done]
  
  Event:
    required: [title, start]
    validate: "end >= start if end exists"

  Credential:
    required: [service, secret_ref]
    forbidden_properties: [password, secret, token]  # Force indirection

relations:
  has_owner:
    from_types: [Project, Task]
    to_types: [Person]
    cardinality: many_to_one
  
  blocks:
    from_types: [Task]
    to_types: [Task]
    acyclic: true  # No circular dependencies

# In SKILL.md frontmatter or header
ontology:
  reads: [Task, Project, Person]
  writes: [Task, Action]
  preconditions:
    - "Task.assignee must exist"
  postconditions:
    - "Created Task has status=open"

Plan: "Schedule team meeting and create follow-up tasks"

1. CREATE Event { title: "Team Sync", attendees: [p_001, p_002] }
2. RELATE Event -> has_project -> proj_001
3. CREATE Task { title: "Prepare agenda", assignee: p_001 }
4. RELATE Task -> for_event -> event_001
5. CREATE Task { title: "Send summary", assignee: p_001, blockers: [task_001] }

# When creating/updating entities, also log to causal action log
action = {
    "action": "create_entity",
    "domain": "ontology", 
    "context": {"type": "Task", "project": "proj_001"},
    "outcome": "created"
}

# Email skill creates commitment
commitment = ontology.create("Commitment", {
    "source_message": msg_id,
    "description": "Send report by Friday",
    "due": "2026-01-31"
})

# Task skill picks it up
tasks = ontology.query("Commitment", {"status": "pending"})
for c in tasks:
    ontology.create("Task", {
        "title": c.description,
        "due": c.due,
        "source": c.id
    })

# Initialize ontology storage
mkdir -p memory/ontology
touch memory/ontology/graph.jsonl

# Create schema (optional but recommended)
python3 scripts/ontology.py schema-append --data &#x27;{
  "types": {
    "Task": { "required": ["title", "status"] },
    "Project": { "required": ["name"] },
    "Person": { "required": ["name"] }
  }
}&#x27;

# Start using
python3 scripts/ontology.py create --type Person --props &#x27;{"name":"Alice"}&#x27;
python3 scripts/ontology.py list --type Person

ontology Typed knowledge graph for structured agent memory and composable skills. Use when creating/querying entities (Person, Project, Task, Event, Document), linkin... MIT-0 · Free to use, modify, and redistribute. No attribution required. ⭐ 417 · 138k · 842 current installs · 868 all-time installs by @oswalpalash MIT-0 Security Scan VirusTotal VirusTotal Benign View report → OpenClaw OpenClaw Benign high confidence The skill is internally consistent: it implements a local, file-based typed knowledge graph (ontology) and does not request extra credentials, network access, or unusual installs. Details ▾ ✓ Purpose &amp; Capability Name/description (typed knowledge graph, entity CRUD, relations, planning) match the included SKILL.md and the Python script. There are no unrelated required env vars, binaries, or config paths. ✓ Instruction Scope Runtime instructions explicitly operate on local files (default memory/ontology/graph.jsonl) and provide commands for create/query/relate/validate. The SKILL.md does not instruct reading unrelated system files or contacting external endpoints. It also documents a policy to not store secrets directly (use secret_ref), which aligns with the described purpose. ✓ Install Mechanism No install spec is provided (instruction-only). The included code is a local Python script; nothing is downloaded or written outside the workspace except the graph file under memory/ontology, which is expected behavior. ✓ Credentials The skill declares no required environment variables or primary credential. The design explicitly avoids storing secrets directly and expects secret references; that is proportionate for an ontology tool. ✓ Persistence &amp; Privilege always is false and model invocation is allowed (platform default). The skill creates/updates a local append-only graph file (memory/ontology/graph.jsonl) which is appropriate for its purpose and does not modify other skills or system-wide agent settings. Assessment This skill appears to be a local, file-backed ontology implementation and is coherent with its description. Before installing, consider: 1) it will write and append to memory/ontology/graph.jsonl in your workspace — ensure you are comfortable with that storage location and retention of the append-only history; 2) the code uses a path resolver that restricts operations to the workspace root (a safety feature), but still review scripts/ontology.py yourself if you need stronger guarantees; 3) the schema enforces that secrets should be stored as secret_ref (not inline) — confirm your secret store integration if you plan to reference credentials; 4) because the skill can be invoked by the agent, be aware that the agent could read/write the ontology autonomously (normal behavior) so only enable it if you trust the agent to manage local data. If you want higher assurance, request the full validate_graph implementation (some code was truncated in the provided file) and scan the script for any hidden network calls or subprocess invocations (none were found in the visible code). Like a lobster shell, security has layers — review code before you run it. Current version v 1.0.4 Download zip latest v k97ffze3zez06e1m81k7nrwn2182qtgz License MIT-0 Free to use, modify, and redistribute. No attribution required. Terms https://spdx.org/licenses/MIT-0.html Files Compare Versions SKILL.md Ontology A typed vocabulary + constraint system for representing knowledge as a verifiable graph. Core Concept Everything is an entity with a type , properties , and relations to other entities. Every mutation is validated against type constraints before committing. Entity: { id, type, properties, relations, created, updated } Relation: { from_id, relation_type, to_id, properties } When to Use Trigger Action &quot;Remember that...&quot; Create/update entity &quot;What do I know about X?&quot; Query graph &quot;Link X to Y&quot; Create relation &quot;Show all tasks for project Z&quot; Graph traversal &quot;What depends on X?&quot; Dependency query Planning multi-step work Model as graph transformations Skill needs shared state Read/write ontology objects Core Types # Agents &amp; People Person: { name, email?, phone?, notes? } Organization: { name, type?, members[] } # Work Project: { name, status, goals[], owner? } Task: { title, status, due?, priority?, assignee?, blockers[] } Goal: { description, target_date?, metrics[] } # Time &amp; Place Event: { title, start, end?, location?, attendees[], recurrence? } Location: { name, address?, coordinates? } # Information Document: { title, path?, url?, summary? } Message: { content, sender, recipients[], thread? } Thread: { subject, participants[], messages[] } Note: { content, tags[], refs[] } # Resources Account: { service, username, credential_ref? } Device: { name, type, identifiers[] } Credential: { service, secret_ref } # Never store secrets directly # Meta Action: { type, target, timestamp, outcome? } Policy: { scope, rule, enforcement } Storage Default: memory/ontology/graph.jsonl {&quot;op&quot;:&quot;create&quot;,&quot;entity&quot;:{&quot;id&quot;:&quot;p_001&quot;,&quot;type&quot;:&quot;Person&quot;,&quot;properties&quot;:{&quot;name&quot;:&quot;Alice&quot;}}} {&quot;op&quot;:&quot;create&quot;,&quot;entity&quot;:{&quot;id&quot;:&quot;proj_001&quot;,&quot;type&quot;:&quot;Project&quot;,&quot;properties&quot;:{&quot;name&quot;:&quot;Website Redesign&quot;,&quot;status&quot;:&quot;active&quot;}}} {&quot;op&quot;:&quot;relate&quot;,&quot;from&quot;:&quot;proj_001&quot;,&quot;rel&quot;:&quot;has_owner&quot;,&quot;to&quot;:&quot;p_001&quot;} Query via scripts or direct file ops. For complex graphs, migrate to SQLite. Append-Only Rule When working with existing ontology data or schema, append/merge changes instead of overwriting files. This preserves history and avoids clobbering prior definitions. Workflows Create Entity python3 scripts/ontology.py create --type Person --props &#x27;{&quot;name&quot;:&quot;Alice&quot;,&quot;email&quot;:&quot;alice@example.com&quot;}&#x27; Query python3 scripts/ontology.py query --type Task --where &#x27;{&quot;status&quot;:&quot;open&quot;}&#x27; python3 scripts/ontology.py get --id task_001 python3 scripts/ontology.py related --id proj_001 --rel has_task Link Entities python3 scripts/ontology.py relate --from proj_001 --rel has_task --to task_001 Validate python3 scripts/ontology.py validate # Check all constraints Constraints Define in memory/ontology/schema.yaml : types: Task: required: [title, status] status_enum: [open, in_progress, blocked, done] Event: required: [title, start] validate: &quot;end &gt;= start if end exists&quot; Credential: required: [service, secret_ref] forbidden_properties: [password, secret, token] # Force indirection relations: has_owner: from_types: [Project, Task] to_types: [Person] cardinality: many_to_one blocks: from_types: [Task] to_types: [Task] acyclic: true # No circular dependencies Skill Contract Skills that use ontology should declare: # In SKILL.md frontmatter or header ontology: reads: [Task, Project, Person] writes: [Task, Action] preconditions: - &quot;Task.assignee must exist&quot; postconditions: - &quot;Created Task has status=open&quot; Planning as Graph Transformation Model multi-step plans as a sequence of graph operations: Plan: &quot;Schedule team meeting and create follow-up tasks&quot; 1. CREATE Event { title: &quot;Team Sync&quot;, attendees: [p_001, p_002] } 2. RELATE Event -&gt; has_project -&gt; proj_001 3. CREATE Task { title: &quot;Prepare agenda&quot;, assignee: p_001 } 4. RELATE Task -&gt; for_event -&gt; event_001 5. CREATE Task { title: &quot;Send summary&quot;, assignee: p_001, blockers: [task_001] } Each step is validated before execution. Rollback on constraint violation. Integration Patterns With Causal Inference Log ontology mutations as causal actions: # When creating/updating entities, also log to causal action log action = { &quot;action&quot;: &quot;create_entity&quot;, &quot;domain&quot;: &quot;ontology&quot;, &quot;context&quot;: {&quot;type&quot;: &quot;Task&quot;, &quot;project&quot;: &quot;proj_001&quot;}, &quot;outcome&quot;: &quot;created&quot; } Cross-Skill Communication # Email skill creates commitment commitment = ontology.create(&quot;Commitment&quot;, { &quot;source_message&quot;: msg_id, &quot;description&quot;: &quot;Send report by Friday&quot;, &quot;due&quot;: &quot;2026-01-31&quot; }) # Task skill picks it up tasks = ontology.query(&quot;Commitment&quot;, {&quot;status&quot;: &quot;pending&quot;}) for c in tasks: ontology.create(&quot;Task&quot;, { &quot;title&quot;: c.description, &quot;due&quot;: c.due, &quot;source&quot;: c.id }) Quick Start # Initialize ontology storage mkdir -p memory/ontology touch memory/ontology/graph.jsonl # Create schema (optional but recommended) python3 scripts/ontology.py schema-append --data &#x27;{ &quot;types&quot;: { &quot;Task&quot;: { &quot;required&quot;: [&quot;title&quot;, &quot;status&quot;] }, &quot;Project&quot;: { &quot;required&quot;: [&quot;name&quot;] }, &quot;Person&quot;: { &quot;required&quot;: [&quot;name&quot;] } } }&#x27; # Start using python3 scripts/ontology.py create --type Person --props &#x27;{&quot;name&quot;:&quot;Alice&quot;}&#x27; python3 scripts/ontology.py list --type Person References references/schema.md — Full type definitions and constraint patterns references/queries.md — Query language and traversal examples Instruction Scope Runtime instructions operate on local files ( memory/ontology/graph.jsonl and memory/ontology/schema.yaml ) and provide CLI usage for create/query/relate/validate; this is within scope. The skill reads/writes workspace files and will create the memory/ontology directory when used. Validation includes property/enum/forbidden checks, relation type/cardinality validation, acyclicity for relations marked acyclic: true , and Event end &gt;= start checks; other higher-level constraints may still be documentation-only unless implemented in code. Files 4 total references/queries.md 5.3 KB references/schema.md 6.5 KB scripts/ontology.py 21 KB SKILL.md 6.5 KB Select a file Select a file to preview. Comments Loading comments…