// Pure: labels and the filter's text in, the indexes of the matching labels
// out, comparing lower-cased text.

/** The indexes of the labels that hold `text`, ignoring letter case, in order. Every index for an empty text. */
export function filterTileIndexes(labels: string[], text: string): number[] {
  const searchedText = text.toLowerCase();
  const indexes: number[] = [];
  for (const [index, label] of labels.entries()) {
    if (label.toLowerCase().includes(searchedText)) {
      indexes.push(index);
    }
  }
  return indexes;
}
