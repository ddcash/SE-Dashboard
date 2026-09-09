## 2026-09-09 - Add accessible labels to URL inputs
**Learning:** Text inputs inside compact flex layouts (e.g. adjacent to a button) often lack space for a visible `<label>`. Screen readers require an accessible name for these inputs.
**Action:** Ensure that standalone text inputs, especially those without a visible `<label>`, include an explicit `aria-label` attribute to provide context.
