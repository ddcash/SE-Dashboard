## 2026-06-28 - Modal Form Accessibility
**Learning:** HTML templates injected via JavaScript can often lack basic accessibility features like programmatic association between labels and inputs, making them difficult for screen readers and keyboard users to navigate.
**Action:** Always ensure that dynamically generated forms use `id` attributes on inputs and matching `for` attributes on `label` elements to guarantee accessibility, even for simple string-based templates.

## 2026-07-15 - Search Empty State Pattern
**Learning:** When search yields no results, presenting unstyled text without clear actions leaves users feeling stuck and breaks the visual immersion of the app.
**Action:** Always use the `.empty-state` container pattern with a relevant icon and a clear call-to-action button (like "Clear Search") for empty result states to maintain consistency and guide the user out of the dead end.
## 2026-10-15 - ARIA Labels on Icon-Only Buttons
**Learning:** Icon-only buttons (like `&times;` for removing tags) lack programmatic context and will be read out as symbols (e.g., "times" or "x") by screen readers, making it difficult for users to understand their function.
**Action:** Always add descriptive `aria-label` attributes to icon-only buttons (e.g., `aria-label="Remove tag"`), incorporating dynamic context like the tag's name if applicable to make the action clear.
