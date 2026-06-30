export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();

  if (!trimmed) {
    return "Enter a name.";
  }

  if (
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes(":")
  ) {
    return "Names cannot contain path separators or colons.";
  }

  return null;
}
