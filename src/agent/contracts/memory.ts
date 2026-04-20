export type MemoryItem = {
  id: string;
  ts: string;
  type: 'note' | 'decision' | 'observation';
  content: string;
  tags?: string[];
};

export type MemorySnapshot = {
  short: MemoryItem[];
  long: MemoryItem[];
};

