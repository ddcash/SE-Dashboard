## 2024-05-24 - [Command Palette XSS via String Interpolation]
**Vulnerability:** Inline JS execution context within an onclick attribute (onclick="window.open('${esc(bm.url)}')") allowed arbitrary JS execution when the URL contained single quotes.
**Learning:** String interpolation directly inside inline event handlers circumvents HTML escaping because the value is interpreted as Javascript *after* HTML decoding.
**Prevention:** Use HTML data attributes (data-url="${esc(url)}") and reference them in the JS handler (this.dataset.url) instead of inline string interpolation.
