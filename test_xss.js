const assert = require('assert');

// ═══════════════════════════════════════════════════════════════
//  SECURITY: URL Sanitization
// ═══════════════════════════════════════════════════════════════
function sanitizeUrl(url) {
  if (!url) return '#';
  try {
    const parsed = new URL(url, 'http://dummy.com');
    const protocol = parsed.protocol.toLowerCase();
    if (['javascript:', 'vbscript:', 'data:'].includes(protocol)) {
      return 'about:blank';
    }
  } catch (e) {
    // If it fails to parse, it might be a relative URL which is fine,
    // or malformed. We can fallback to esc(url) or just return url if it doesn't look like an absolute malicious one.
    // However, a simple regex match is safer to just catch starting with bad protocols
  }

  // Safer regex-based sanitization that doesn't rely on URL parsing which might fail on relative URLs
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return 'about:blank';
  }
  return trimmed;
}

assert.strictEqual(sanitizeUrl('javascript:alert(1)'), 'about:blank');
assert.strictEqual(sanitizeUrl('  javascript: alert(1) '), 'about:blank');
assert.strictEqual(sanitizeUrl('JAVAScript:alert(1)'), 'about:blank');
assert.strictEqual(sanitizeUrl('data:text/html,<script>alert(1)</script>'), 'about:blank');
assert.strictEqual(sanitizeUrl('https://example.com'), 'https://example.com');
assert.strictEqual(sanitizeUrl('/relative/path'), '/relative/path');
console.log("Tests passed");
