# Gleeye UI Design & Component Directives

You MUST follow these rules for all UI developments and modifications. These rules take precedence over general defaults.

## 1. No Native Browser Components
**NEVER** use native browser components for user interactions. This is a PR-blocking requirement.

- **No `window.confirm()`**: Use `utils.showConfirm` (to be implemented) or a custom glass-card modal.
- **No `window.alert()`**: Use `utils.showGlobalAlert`.
- **No `<select>` (Native)**: Use the `CustomSelect` component from `js/components/CustomSelect.js`.
- **No `prompt()`**: Always implement a custom text input modal.

## 2. Aesthetics & Themes
All components must follow the **"Glassmorphism"** theme:
- **Backgrounds**: `rgba(255, 255, 255, 0.7)` with `backdrop-filter: blur(10px)`.
- **Borders**: `1px solid rgba(255, 255, 255, 0.3)`.
- **Border Radius**: Use `12px` or `16px` for cards/modals.
- **Shadows**: Soft, layered shadows (e.g., `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1)`).

## 3. Interaction Patterns
- **Quick Status Change**: Always use a non-native dropdown (CustomSelect) for status badges.
- **Confirmations**: Before destructive actions (Delete, Reset), show a custom-styled modal with "Cancel" (secondary) and "Confirm" (primary/danger) buttons.
- **Loading States**: Show the standard `.loader` element during async operations.

## 4. State Synchronization & Reactivity
**CRITICAL**: Every action that modifies data (Add, Edit, Delete, Status Change) MUST immediately update the global `state` and the UI without requiring a manual page reload.
- **Delete**: Remove the item from `state[collection]` immediately after successful API call.
- **Update**: Find and update the item in `state[collection]` with the new data.
- **Re-render**: Trigger a re-render of the current view or the relevant components after state update.

## 5. Smart Navigation
- **Redirects after Delete**: Do NOT hardcode redirection to a dashboard (e.g., `#assignments`). Check if the user came from another detail page (e.g., `#order-detail`) and redirect there, or use `window.history.back()`.

## 6. Code Documentation
- Always check `js/modules/utils.js` for existing utility functions before implementing new ones.
- Check `js/components/` for reusable UI elements.
