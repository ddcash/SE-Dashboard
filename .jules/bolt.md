## 2025-06-30 - Inefficient lookups in innerHTML render loops
**Learning:** Because this vanilla JS app reconstructs the DOM using `innerHTML` string concatenation on every search keystroke, any inefficient array lookups (like `.find()`) inside the tight render loop multiply dramatically. High frequency handlers (like `pointermove` for dragging) must also strictly avoid array-creation methods like `Object.entries`.
**Action:** Always check the time complexity of functions called inside `render()`, especially list-rendering functions. Pass known reference objects down directly instead of making child functions do lookups by ID. Keep `pointermove` paths lean by using simple `for...in` loops.

## 2025-07-02 - Unnecessary array flattening and sorting in idempotent render setup
**Learning:** `autoArrangeCards` acts as an idempotent setup for new bookmarks. However, because `render()` is called on every keystroke, sorting a flattened array of *all* bookmarks simply to find missing positions causes massive CPU thrashing, particularly when there is no new work to do.
**Action:** When writing idempotent setup code that iterates collections, always include an early exit pass to check if work actually needs to be done *before* allocating arrays or performing expensive sorting.

## 2025-07-04 - Inefficient HTML string modification in tight render loops
**Learning:** Because this vanilla JS app reconstructs the DOM using `innerHTML` string concatenation, executing regular expression replacements (`.replace(new RegExp(...))`) on the massive aggregate HTML string to inject sub-components (like card groups) causes severe CPU blocking and scaling issues.
**Action:** Always accumulate child HTML strings in memory and pass them directly into parent rendering functions (e.g. `renderGroup(group, innerHTML)`), rather than generating a skeleton and searching the massive DOM string afterward to inject content.
## 2025-07-06 - Redundant operations in tight loops (search/filter)
**Learning:** Because the app reconstructs the DOM using `innerHTML` on every search keystroke, any small overhead multiplies enormously across large lists. Generating thousands of new strings via `.toLowerCase()` and re-evaluating loop-invariant string matches for `category.name` on every single bookmark in that category creates enormous CPU thrashing.
**Action:** When iterating over collections on high-frequency events (like keystrokes): 1) Precompute and cache string formatting (e.g., lowercased queries). 2) Hoist evaluations of parent/loop-invariant properties (like category names) out of the inner loop to skip redundant work.

## 2025-07-08 - Array.includes() lookups in high-frequency functions
**Learning:** Checking for item visibility inside a tight render loop using `Array.includes()` on the `S.cfg.hidden` array results in O(N) complexity for every single bookmark. When combined with the UI's aggressive DOM regeneration via `innerHTML` on every keystroke, this algorithmic inefficiency multiplies enormously, causing significant main thread blocking for large collections.
**Action:** When a high-frequency loop needs to perform membership checks against a collection that mutates infrequently but is read constantly, always convert the collection to a `Set` to achieve O(1) lookups. To maintain performance, ensure the Set is cached and invalidated correctly.
**Action (Invalidation):** Be aware that JS arrays mutated in-place (e.g., via `.push()`) do not change their object reference. Therefore, when building a cache invalidator based on `S.cfg.hidden` array references, you must check *both* reference equality (`ref !== arr`) and array length (`len !== arr.length`) to safely and reliably invalidate the cached Set without producing stale state bugs.
