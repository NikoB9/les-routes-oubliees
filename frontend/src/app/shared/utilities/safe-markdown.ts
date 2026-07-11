export type SafeMarkdownBlock =
  | {
      kind: 'heading';
      level: 2 | 3;
      text: string;
    }
  | {
      kind: 'paragraph';
      text: string;
    }
  | {
      kind: 'list';
      items: string[];
    };

export function parseSafeMarkdown(markdown: string | null | undefined): SafeMarkdownBlock[] {
  if (!markdown?.trim()) {
    return [];
  }

  const blocks: SafeMarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    blocks.push({
      kind: 'paragraph',
      text: paragraphLines.join(' ').replace(/\s+/g, ' ').trim(),
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push({ kind: 'list', items: listItems });
    listItems = [];
  };

  for (const rawLine of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: 'heading',
        level: heading[1].length === 1 ? 2 : 3,
        text: heading[2].trim(),
      });
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
