export function validateBearerToken(
  authHeader: string | undefined,
  expectedToken: string
): boolean {
  if (!authHeader || !expectedToken) return false;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;
  return parts[1] === expectedToken;
}
