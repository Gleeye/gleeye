// Hub drawer — shared constants for status + priority of pm_items.
// Extracted from hub_drawer.js (first step of splitting the 2930-line monolith).
//
// Public exports:
//   - ITEM_STATUS   { todo, in_progress, blocked, review, done } → label/color/bg
//   - ITEM_PRIORITY { low, medium, high, urgent } → label/color
//
// These maps are also the source of truth for any future component that
// needs to render task status/priority badges; consider importing from here
// instead of redefining inline.

export const ITEM_STATUS = {
    'todo': { label: 'Da Fare', color: '#94a3b8', bg: '#f1f5f9' },
    'in_progress': { label: 'In Corso', color: '#3b82f6', bg: '#eff6ff' },
    'blocked': { label: 'Bloccato', color: '#ef4444', bg: '#fef2f2' },
    'review': { label: 'Revisione', color: '#f59e0b', bg: '#fffbeb' },
    'done': { label: 'Completata', color: '#10b981', bg: '#ecfdf5' }
};

export const ITEM_PRIORITY = {
    'low': { label: 'Bassa', color: '#64748b' },
    'medium': { label: 'Media', color: '#3b82f6' },
    'high': { label: 'Alta', color: '#f59e0b' },
    'urgent': { label: 'Urgente', color: '#ef4444' }
};
