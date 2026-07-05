
## 2024-05-24 - Add ARIA live regions to toast notifications
**Learning:** In dynamically generated UI elements like toast notifications, using \`aria-live\` (e.g., \`aria-live="polite"\`) and \`role="status"\` is critical to ensure that screen readers announce the newly added content without stealing focus from the user's current task. Without these, the feedback goes unnoticed by visually impaired users.
**Action:** Always include \`role="status"\` and \`aria-live\` attributes on dynamic status/notification wrappers so that screen readers correctly handle transient messages.
