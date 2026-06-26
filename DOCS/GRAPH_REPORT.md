# Graph Report - .  (2026-06-26)

## Corpus Check
- Corpus is ~177 words - fits in a single context window. You may not need a graph.

## Summary
- 9 nodes · 10 edges · 2 communities
- Extraction: 60% EXTRACTED · 40% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Graphify Interaction Commands|Graphify Interaction Commands]]
- [[_COMMUNITY_Project Documentation and Workflow|Project Documentation and Workflow]]

## God Nodes (most connected - your core abstractions)
1. `Graphify Knowledge Graph Rule` - 7 edges
2. `Graphify Workflow` - 4 edges
3. `graphify-out Directory` - 2 edges
4. `SE-Dashboard Project` - 2 edges
5. `graphify query Command` - 1 edges
6. `graphify path Command` - 1 edges
7. `graphify explain Command` - 1 edges
8. `graphify update Command` - 1 edges
9. `Graphify Skill Documentation` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Graphify Knowledge Graph Rule` --conceptually_related_to--> `SE-Dashboard Project`  [INFERRED]
  .agents/rules/graphify.md → README.md
- `Graphify Workflow` --semantically_similar_to--> `Graphify Knowledge Graph Rule`  [INFERRED] [semantically similar]
  .agents/workflows/graphify.md → .agents/rules/graphify.md
- `Graphify Workflow` --conceptually_related_to--> `SE-Dashboard Project`  [INFERRED]
  .agents/workflows/graphify.md → README.md
- `Graphify Workflow` --conceptually_related_to--> `graphify-out Directory`  [INFERRED]
  .agents/workflows/graphify.md → .agents/rules/graphify.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Interaction Tools** — rules_graphify_graphify_query, rules_graphify_graphify_path, rules_graphify_graphify_explain, rules_graphify_graphify_update [EXTRACTED 1.00]

## Communities (2 total, 0 thin omitted)

### Community 0 - "Graphify Interaction Commands"
Cohesion: 0.40
Nodes (5): graphify explain Command, graphify path Command, graphify query Command, Graphify Knowledge Graph Rule, graphify update Command

### Community 1 - "Project Documentation and Workflow"
Cohesion: 0.50
Nodes (4): SE-Dashboard Project, graphify-out Directory, Graphify Skill Documentation, Graphify Workflow

## Knowledge Gaps
- **5 isolated node(s):** `graphify query Command`, `graphify path Command`, `graphify explain Command`, `graphify update Command`, `Graphify Skill Documentation`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Graphify Knowledge Graph Rule` connect `Graphify Interaction Commands` to `Project Documentation and Workflow`?**
  _High betweenness centrality (0.804) - this node is a cross-community bridge._
- **Why does `Graphify Workflow` connect `Project Documentation and Workflow` to `Graphify Interaction Commands`?**
  _High betweenness centrality (0.268) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Graphify Knowledge Graph Rule` (e.g. with `SE-Dashboard Project` and `Graphify Workflow`) actually correct?**
  _`Graphify Knowledge Graph Rule` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `Graphify Workflow` (e.g. with `SE-Dashboard Project` and `graphify-out Directory`) actually correct?**
  _`Graphify Workflow` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `SE-Dashboard Project` (e.g. with `Graphify Knowledge Graph Rule` and `Graphify Workflow`) actually correct?**
  _`SE-Dashboard Project` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `graphify query Command`, `graphify path Command`, `graphify explain Command` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._