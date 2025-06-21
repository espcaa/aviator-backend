// Disclaimer : Written 100% by AI

// RegEx to detect unacceptable characters (invisible, control, exotic emojis, etc.)
const disallowedCharsRegex =
  /[\p{C}\p{Zs}\u200B-\u200D\uFEFF\u00A0\u2028\u2029\u2060\uFFF9-\uFFFB]/gu;

export function sanitizePassword(password: string): string | null {
  // Step 1: Trim surrounding spaces
  const trimmed = password.trim();

  // Step 2: Normalize to prevent homoglyph attacks (e.g. `𝐩𝐚𝐬𝐬𝐰𝐨𝐫𝐝` ≠ `password`)
  const normalized = trimmed.normalize("NFKC");

  // Step 3: Remove disallowed characters (e.g. invisible, non-printing)
  const cleaned = normalized.replace(disallowedCharsRegex, "");

  // Step 4: Enforce length constraints
  if (cleaned.length < 8 || cleaned.length > 256) {
    return null;
  }

  // Step 5: Enforce strong password policy:
  const hasUpperCase = /[A-Z]/.test(cleaned);
  const hasLowerCase = /[a-z]/.test(cleaned);
  const hasDigit = /[0-9]/.test(cleaned);
  const hasSymbol = /[!@#$%^&*()_\-+={[}\]|:;"'<>,.?/~`]/.test(cleaned);

  const hasIllegalWhitespace = /\s/.test(cleaned);

  if (
    !hasUpperCase ||
    !hasLowerCase ||
    !hasDigit ||
    !hasSymbol ||
    hasIllegalWhitespace
  ) {
    return null;
  }

  return cleaned;
}
