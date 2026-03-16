/**
 * Minimal markdown-to-HTML renderer.
 * Handles the subset of markdown that the Vrrbose agent commonly produces.
 * Avoids adding a heavy library dependency.
 */

function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderMarkdown(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<pre><code>${escape(codeBuffer.join('\n'))}</code></pre>`);
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h1>${inlineMarkdown(h1[1])}</h1>`); continue; }
    if (h2) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h2>${inlineMarkdown(h2[1])}</h2>`); continue; }
    if (h3) { if (inList) { out.push('</ul>'); inList = false; } out.push(`<h3>${inlineMarkdown(h3[1])}</h3>`); continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push('<hr>');
      continue;
    }

    // Unordered list items
    const listMatch = line.match(/^[\-\*]\s+(.*)/);
    if (listMatch) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineMarkdown(listMatch[1])}</li>`);
      continue;
    }

    // Numbered list items
    const numMatch = line.match(/^\d+\.\s+(.*)/);
    if (numMatch) {
      if (!inList) { out.push('<ol>'); inList = true; }
      out.push(`<li>${inlineMarkdown(numMatch[1])}</li>`);
      continue;
    }

    // Close list on blank or non-list line
    if (inList) {
      out.push('</ul>');
      inList = false;
    }

    // Blank line → paragraph break
    if (line.trim() === '') {
      out.push('<br>');
      continue;
    }

    // Regular paragraph line
    out.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  if (inList) out.push('</ul>');
  if (inCodeBlock && codeBuffer.length) {
    out.push(`<pre><code>${escape(codeBuffer.join('\n'))}</code></pre>`);
  }

  return out.join('');
}

function inlineMarkdown(text: string): string {
  return escape(text)
    // Bold+italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
