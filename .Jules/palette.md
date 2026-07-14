## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2024-02-17 - Empty State Screen Reader Accessibility
**Learning:** Dynamic empty states (like "no search results" or "no categories yet") are not automatically announced by screen readers when they appear in a single-page app, leaving visually impaired users unaware that the content has changed or a search has failed.
**Action:** Always add `aria-live="polite"` to empty state containers to ensure screen readers announce their appearance without interrupting the user.
