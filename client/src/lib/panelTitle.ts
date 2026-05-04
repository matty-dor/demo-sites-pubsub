/** Saved rules title is `eventName: suffix`; returns the suffix from the Panel title input. */
export function panelTitleSuffixFromSaved(fullTitle: string, eventName: string): string {
  const prefix = `${eventName}: `
  if (fullTitle.startsWith(prefix)) {
    return fullTitle.slice(prefix.length)
  }
  return fullTitle
}
