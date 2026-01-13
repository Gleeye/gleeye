# Directive: General Development Workflow

**Goal**: Implement features or fixes with high reliability using the Gleeye ERP stack.

**Inputs**:
- `TASK_DESCRIPTION`: What needs to be done.
- `AFFECTED_FILES`: List of files involved.

## Step 1: Planning (Orchestration)
**Action**: Before writing code, analyze the codebase.
**Tools**:
- `grep_search`: To find relevant code.
- `view_file`: To understand context.
**Rule**: Always create an `implementation_plan.md` for non-trivial tasks.

## Step 2: Implementation (Execution)
**Action**: Modify code.
**Tools**:
- `replace_file_content`: For single edits.
- `execution/sync_db.js`: Run this if DB schema changes are made.

## Step 3: Verification (Execution)
**Action**: Verify the changes.
**Command**:
- If UI change: `open_browser` to check manually.
- If Logic change: Run relevant `check_*.py` scripts in `execution/`.

## Quality Control Rules
- **Formatting**: Adhere to `brand_guidelines.md` (Outfit font, specific colors).
- **Persistence**: If a fix fails, read the error, update the plan, and retry.
