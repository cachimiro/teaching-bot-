/** Removes control characters Postgres can't store (NUL etc.), keeping tabs and newlines. */
export function stripControlChars(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

/** Strips the answer-line dot leaders and blank noise that PDF extraction leaves behind. */
export function cleanPdfText(text: string): string {
  return stripControlChars(text)
    .replace(/\.(?:[ \t]\.){3,}/g, "____")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
