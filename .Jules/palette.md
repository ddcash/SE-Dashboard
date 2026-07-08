## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2026-07-28 - Empty State Accessibility
**Learning:** Dynamic empty state containers that replace existing content (e.g., when a search yields no results or categories are empty) must include the `aria-live` attribute to ensure screen readers announce the state change.
**Action:** Always add `aria-live="polite"` to `.empty-state` container divs in dynamically rendered templates to improve accessibility for visually impaired users.
