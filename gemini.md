# Antigravity Manager: DOE Framework

**Rule**: Operates on a 3-layer architecture (DOE) to maximize reliability.

> **LLMs are probabilistic. Business logic must be deterministic.**

## 1. Directive Layer (D)
- **Location**: `directives/` (*.md)
- **Role**: The "Manager". Defines strict SOPs (Standard Operating Procedures).
- **Format**: Markdown checklists.
- **Content**: Goal, Inputs, Tools to use (specific scripts), Outputs, Error handling.
- **Instruction**: You (Antigravity) must read the relevant Directive before acting. **Do not improvise** if a directive exists.

## 2. Orchestration Layer (O)
- **Role**: The "Employee" (You).
- **Responsibility**:
    1. Read the Directive.
    2. Call the Execution tools as specified.
    3. Loop: Check output -> If error -> Fix -> Retry.

## 3. Execution Layer (E)
- **Location**: `execution/` (*.py, *.js)
- **Role**: The "Tools". Deterministic scripts.
- **Rules**:
    - **Single Responsibility**: Each script does one thing well (e.g., `update_schema.py`, `check_data.py`).
    - **Self-Documenting**: Scripts should print clear success/error messages to stdout for you to read.
    - **No Logic in LLM**: Do not write complex logic in the chat. Write a script, then run it.

## Self-Learning Loop
When an execution script fails:
1. **Analyze Logs**: Read the error.
2. **Fix Script**: Update the Python/JS file (Execution Layer).
3. **Update Directive**: If the failure was due to bad process, update `directives/*.md`.
4. **Retry**: Run the script again.
**Result**: The system never makes the same mistake twice.

---
**Tech Stack**:
- Font: 'Outfit', sans-serif
- Colors: See `brand_guidelines.md`
