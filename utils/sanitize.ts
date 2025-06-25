// Disclaimer : Written 100% by AI

// RegEx to detect unacceptable characters (invisible, control, exotic emojis, etc.)
const disallowedCharsRegex =
  /[\p{C}\p{Zs}\u200B-\u200D\uFEFF\u00A0\u2028\u2029\u2060\uFFF9-\uFFFB]/gu;

export function sanitizePassword(password: string): string | null {
  const trimmed = password.trim();

  const normalized = trimmed.normalize("NFKC");

  const cleaned = normalized.replace(disallowedCharsRegex, "");

  if (cleaned.length < 8 || cleaned.length > 256) {
    return null;
  }

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
