# AI Roadmap

This project is a strong fit for AI because it already has three things most AI admin tools need:

- authenticated users
- structured RBAC and audit-log data
- a dashboard where explanations and recommendations are naturally useful

## Phase 1: Grounded assistant

Status: implemented in this branch.

Goal:
- Let signed-in users ask natural-language questions about RBAC posture, visible dashboard metrics, and recent audit activity.

Shipped:
- protected backend endpoint at `/api/ai/assistant`
- dashboard assistant UI in the main dashboard
- OpenAI Responses API integration via `OPENAI_API_KEY`
- context grounding from the signed-in user plus dashboard summary data

Why it matters:
- Gives the product an immediately visible AI capability.
- Keeps the assistant narrow and explainable instead of pretending to be a general-purpose copilot.

## Phase 2: Audit insights

Goal:
- Detect suspicious or operationally important patterns in audit logs.

Status: implemented in this branch as an AI-generated dashboard insight panel.

Examples:
- unusual spikes in permission changes
- repeated failed login or refresh activity
- projects or users with sudden bursts of admin actions

Implementation ideas:
- add a nightly AI summary job
- surface “Top 3 anomalies” on the dashboard
- store AI-generated summaries with timestamps for traceability

## Phase 3: Role and permission recommendations

Goal:
- Help admins tighten or simplify access decisions.

Status: implemented in this branch as an AI recommendations panel on the Roles page.

Examples:
- “These roles overlap heavily and could be merged.”
- “This user appears to hold broader access than recent activity suggests they need.”
- “This role may be missing `projects.read` based on common task flow.”

Guardrails:
- AI should recommend changes, never auto-apply them
- every recommendation should cite the permissions or activity pattern behind it

## Phase 4: Policy simulation and change review

Goal:
- Let admins test a proposed RBAC change before applying it.

Examples:
- “If I remove `projects.edit` from EDITOR, what workflows are likely affected?”
- “What screens become inaccessible if I create a read-only support role?”

Implementation ideas:
- compare required route permissions against proposed role definitions
- generate human-readable impact summaries before saving role changes

## Phase 5: Governance and trust

Goal:
- Make AI safe enough for a real admin product.

Needed work:
- persist AI request/response metadata in audit logs
- add prompt redaction for secrets and tokens
- add rate limits and per-role AI access controls
- show exactly which data sources were used in each answer
- add evaluation tests for accuracy and refusal behavior

## Recommended next build order

1. Keep Phase 1 in the dashboard and gather usage feedback.
2. Add audit anomaly summaries because your audit data is already present.
3. Add role recommendation explainers on the Roles page.
4. Add policy simulation before any “AI-assisted change” workflow.
