export interface FormattedBriefSection {
  label: string | null;
  text: string;
  tone: "attention" | "default";
}

const BOLD_SECTION_PATTERN = /\*\*([^*\n]+?)\*\*/g;
const LABELED_LINE_PATTERN = /^([A-Za-z][A-Za-z /&-]{1,40}):\s*(.+)$/;
const SUMMARY_TITLE_PATTERN = /^pre[-\s]?consultation summary\b/i;

function cleanText(value: string): string {
  return value
    .replace(/^[\s:–—-]+/, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

function cleanLabel(value: string): string {
  return value.replace(/^#+\s*/, "").replace(/:\s*$/, "").trim();
}

function sectionTone(label: string | null): FormattedBriefSection["tone"] {
  if (!label) return "default";
  return /allerg|abnormal/i.test(label) ? "attention" : "default";
}

function makeSection(
  label: string | null,
  text: string,
): FormattedBriefSection | null {
  const cleanedText = cleanText(text);
  if (!cleanedText) return null;
  const cleanedLabel = label ? cleanLabel(label) : null;
  return {
    label: cleanedLabel,
    text: cleanedText,
    tone: sectionTone(cleanedLabel),
  };
}

function parseMarkdownSections(content: string): FormattedBriefSection[] | null {
  const matches = [...content.matchAll(BOLD_SECTION_PATTERN)];
  if (matches.length === 0) return null;

  const sections: FormattedBriefSection[] = [];
  const firstMatchIndex = matches[0]?.index ?? 0;
  const preamble = makeSection(null, content.slice(0, firstMatchIndex));
  if (preamble) sections.push(preamble);

  matches.forEach((match, index) => {
    const label = cleanLabel(match[1] ?? "");
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = matches[index + 1]?.index ?? content.length;
    const text = content.slice(contentStart, contentEnd);

    if (SUMMARY_TITLE_PATTERN.test(label)) {
      const summary = makeSection(null, text);
      if (summary) sections.push(summary);
      return;
    }

    const section = makeSection(label, text);
    if (section) sections.push(section);
  });

  return sections;
}

function parsePlainTextSections(content: string): FormattedBriefSection[] {
  const lines = content
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);

  return lines.flatMap((line) => {
    const match = line.match(LABELED_LINE_PATTERN);
    const section = match
      ? makeSection(match[1] ?? null, match[2] ?? "")
      : makeSection(null, line);
    return section ? [section] : [];
  });
}

export function formatBriefContent(content: string): FormattedBriefSection[] {
  const normalized = content.trim();
  if (!normalized) return [];
  return parseMarkdownSections(normalized) ?? parsePlainTextSections(normalized);
}
