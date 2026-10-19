# Scheduling MVP scope and authority boundary

Date: 2026-10-18. The user authorized implementing the previously discussed MVP and using the supplied DeepSeek API key.

The previous repository non-goal excluded RAG, while the dossier and subsequent product outline included current preference retrieval. The implemented scope now includes versioned, metadata-filtered lexical preference lookup, with separate supporting/excluded evidence. A vector database, embedding service and custom training remain deferred. Hard rules are never dropped by a relevance cutoff.

The archived S08 experiment showed that a model could acknowledge a deadline violation while still proposing that slot, and the old experimental gate accepted it. The application instead asks the model only to extract constraints; deterministic code selects and checks a slot. It cross-checks supported explicit numeric constraints against the original request, surfaces resolved fields, and revalidates at approval time. General language understanding is still fallible; this does not prove all possible request constraints are recognized.

Calendar authority is separated from interpretation. Only an explicit user approval of a stored proposal can create/move/delete an event. Approval is transactional, idempotent and sensitive to changed context/target versions. The model has no write tool. A direct DeepSeek JSON client is used instead of an unconstrained coding-agent runtime. SQLite access uses explicit SQL migrations and transactions; installed Drizzle/pi dependencies need not be executed merely because the scaffold contains them.

Scope remains local and single-user: daily availability, non-recurring events, controlled task tags, rubric complexity, preference versioning, explainable drafts and persistent calendar state. Larger/smaller-model comparisons, teacher guidance, distillation, latency research, edge deployment, external sync and background rescheduling remain research or later integration work.
