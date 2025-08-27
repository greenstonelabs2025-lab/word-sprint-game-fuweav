
# Word Sprint — Prompt Rules

## Character Limit
- Hard cap: **≤ 3500 characters per prompt** (including code + text).
- Count all characters: whitespace, code blocks, markdown formatting.

## Completeness
- **Every prompt is complete**: no partial edits, no "insert above/below".
- **Always wrap** the entire prompt inside triple backticks ```…```.
- When updating a feature, **restate the full file(s)** being changed.

## Splitting Large Tasks
- If a task exceeds the cap: **split into WS-STEP1, WS-STEP2, …** where each step is self-contained and valid.
- Each step must be runnable independently.
- Include context in each step if needed.

## Language & Style
- Use **UK English**, concise wording, and production-ready code.
- Keep prompts **modular**: 1 focused concern per prompt when possible.
- No verbose explanations unless critical for understanding.

## UI Guidelines
- Do not add popups unless specified; match existing UI styles.
- Use existing GradientButton component consistently.
- Maintain SafeArea + fullscreen background patterns.
- Follow existing colour schemes and typography.

## Technical Standards
- Import existing utilities from their established locations.
- Maintain TypeScript interfaces and proper typing.
- Use established patterns for state management and data flow.
- Follow existing file structure and naming conventions.
