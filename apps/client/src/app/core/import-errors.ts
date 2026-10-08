/** Up to 3 problems found in pasted import text, in one message. */
export function importErrorMessage(errors: string[]): string {
  const more = errors.length > 3 ? ` And ${errors.length - 3} more.` : "";
  return errors.slice(0, 3).join(" ") + more;
}
