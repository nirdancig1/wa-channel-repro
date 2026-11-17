# WA Channel Repro — Story
**App purpose:** production (minimal test/repro app)

User asked for exactly: agent Ron (PurchasingAssistant, purchasing assistant, 2-sentence instructions, no chat/mini-app), workflow Nightly (Scheduler 0 2 * * * UTC → SendNightlySummary action → SendAgentMessage "Summarize today" to Ron), and a home page with the title. Keep it minimal; don't add features or ask questions.

## Recent changes
- 2026-11-17: Ron's instructions gained a final sentence: "Always answer in a friendly tone."
- 2026-11-17: initial build.
