## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.

## 2024-10-02 - Master Editor Form Accessibility
**Learning:** Dynamically generated input fields in complex lists or tables (like a bulk editor) often lose their programmatic label association if `id` and `for` attributes aren't used, making it very difficult for screen reader users to understand what each input represents in the grid.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility. Incorporate the loop item's unique identifier (e.g., `id="master-bm-title-${bm.id}"`) to prevent ID collisions across multiple rendered list items.
