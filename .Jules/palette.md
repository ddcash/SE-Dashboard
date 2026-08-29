## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2025-03-09 - Master Editor Modal Accessibility
**Learning:** Dynamically generated HTML templates in modals often lack proper label associations, which makes it hard for screen readers and keyboard users to navigate inputs.
**Action:** Always add unique `id` attributes to inputs and matching `for` attributes to `label` elements when generating forms dynamically (e.g., appending unique identifiers like `${cat.id}` and `${bm.id}` in iterative rendering logic). Ensure interactive elements without visible text (or ambiguous context) have descriptive `aria-label` attributes.
