export type ChangelogSection = {
  heading: string;
  entries: string[];
};

export function parseChangelog(notes: string | undefined): ChangelogSection[] {
  if (!notes?.trim()) {
    return [];
  }

  return notes
    .split(/(?=^## )/m)
    .map((section) => {
      const lines = section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const heading = lines.shift()?.replace(/^#+\s*/, "");
      if (!heading || (heading === "Changelog" && lines.length === 0)) {
        return null;
      }

      return {
        heading,
        entries: lines.map((line) => line.replace(/^-\s+/, "")),
      };
    })
    .filter((section): section is ChangelogSection => section !== null);
}
