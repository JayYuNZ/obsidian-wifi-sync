/**
 * Sanitizes a vault-relative file path, rejecting any path that could be
 * used for directory traversal or other attacks.
 *
 * Returns the normalized path on success, or null if the path is invalid.
 */
export function sanitizePath(path: string): string | null {
  if (!path || path.trim() === "") return null;

  // Normalize backslashes
  const normalized = path.replace(/\\/g, "/");

  // Reject absolute paths
  if (normalized.startsWith("/")) return null;

  // Reject protocol-like paths (e.g. file://, http://)
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(normalized)) return null;

  // Check each segment
  const segments = normalized.split("/");
  for (const segment of segments) {
    // Reject traversal components
    if (segment === ".." || segment === ".") return null;
    // Reject null bytes
    if (segment.includes("\0")) return null;
    // Reject empty segments (double slashes)
    if (segment === "" && segments.indexOf(segment) !== segments.length - 1) return null;
  }

  // Strip any trailing slash
  return normalized.replace(/\/$/, "");
}
