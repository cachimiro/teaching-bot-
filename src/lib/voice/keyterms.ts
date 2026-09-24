const MAX_TERMS = 20;

/**
 * Subject words to boost in live speech recognition (Deepgram keyterm prompting), so
 * "osmosis" or "abiotic" aren't misheard. Taken from the topic title and its Key terms list.
 */
export function topicKeyterms(topic: { title: string; notes: string }): string[] {
  const section = topic.notes.split(/^## Key terms\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const terms = [...section.matchAll(/^- \*\*(.+?)\*\*/gm)].map((m) => m[1].trim());
  const unique = [...new Set([topic.title, ...terms])].filter((t) => t.length > 0 && t.length <= 40);
  return unique.slice(0, MAX_TERMS);
}
