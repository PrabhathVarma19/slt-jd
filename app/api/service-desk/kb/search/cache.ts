export type PolicyChunk = {
  id: string;
  filePath: string;
  title: string;
  content: string;
  index: number;
};

let cachedChunks: PolicyChunk[] | null = null;

export function getKbCachedChunks(): PolicyChunk[] | null {
  return cachedChunks;
}

export function setKbCachedChunks(chunks: PolicyChunk[]): void {
  cachedChunks = chunks;
}

export function resetKbCache(): void {
  cachedChunks = null;
}
