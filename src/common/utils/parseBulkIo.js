/**
 * Parse many input/output pairs from one paste box.
 *
 * Formats:
 *   input
 *   ---
 *   output
 *   ===
 *   next input
 *   ---
 *   next output
 *
 * Or repeating --- only (input, output, input, output, ...).
 * Also accepts INPUT: / OUTPUT: labels in a block.
 */
export function parseBulkIo(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const blocks = text
    .split(/^\s*===\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);

  const pairs = [];
  for (const block of blocks) {
    const labeled = parseLabeledBlock(block);
    if (labeled) {
      pairs.push(labeled);
      continue;
    }

    if (/^\s*---\s*$/m.test(block)) {
      const parts = block.split(/^\s*---\s*$/m).map(normalizePart);
      if (parts.length === 2) {
        pairs.push({ input: parts[0], output: parts[1] });
      } else if (parts.length > 2) {
        for (let i = 0; i + 1 < parts.length; i += 2) {
          pairs.push({ input: parts[i], output: parts[i + 1] });
        }
        if (parts.length % 2 === 1 && parts[parts.length - 1]) {
          pairs.push({ input: parts[parts.length - 1], output: '' });
        }
      }
      continue;
    }

    pairs.push({ input: block, output: '' });
  }

  return pairs.filter((p) => p.input || p.output);
}

function normalizePart(part) {
  return String(part || '').replace(/^\n/, '').replace(/\n$/, '');
}

function parseLabeledBlock(block) {
  const inputMatch = block.match(/^\s*INPUT\s*:\s*([\s\S]*?)(?=^\s*OUTPUT\s*:|$)/im);
  const outputMatch = block.match(/^\s*OUTPUT\s*:\s*([\s\S]*)$/im);
  if (!inputMatch && !outputMatch) return null;
  if (!inputMatch || !outputMatch) return null;
  return {
    input: normalizePart(inputMatch[1]).trimEnd(),
    output: normalizePart(outputMatch[1]).trim(),
  };
}
