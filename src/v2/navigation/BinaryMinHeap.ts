type HeapEntry<T> = {
  value: T;
  priority: number;
  sequence: number;
};

/** Small stable binary min-heap used by A*. */
export class BinaryMinHeap<T> {
  private readonly entries: HeapEntry<T>[] = [];
  private sequence = 0;

  get size() {
    return this.entries.length;
  }

  clear() {
    this.entries.length = 0;
    this.sequence = 0;
  }

  push(value: T, priority: number) {
    const entry: HeapEntry<T> = { value, priority, sequence: this.sequence++ };
    this.entries.push(entry);
    this.bubbleUp(this.entries.length - 1);
  }

  pop(): T | undefined {
    if (this.entries.length === 0) return undefined;
    const first = this.entries[0];
    const last = this.entries.pop()!;
    if (this.entries.length > 0) {
      this.entries[0] = last;
      this.sinkDown(0);
    }
    return first.value;
  }

  private comesBefore(a: HeapEntry<T>, b: HeapEntry<T>) {
    return a.priority < b.priority || (a.priority === b.priority && a.sequence < b.sequence);
  }

  private bubbleUp(index: number) {
    let cursor = index;
    while (cursor > 0) {
      const parent = Math.floor((cursor - 1) / 2);
      if (!this.comesBefore(this.entries[cursor], this.entries[parent])) break;
      [this.entries[cursor], this.entries[parent]] = [this.entries[parent], this.entries[cursor]];
      cursor = parent;
    }
  }

  private sinkDown(index: number) {
    let cursor = index;
    while (true) {
      const left = cursor * 2 + 1;
      const right = left + 1;
      let next = cursor;
      if (left < this.entries.length && this.comesBefore(this.entries[left], this.entries[next])) next = left;
      if (right < this.entries.length && this.comesBefore(this.entries[right], this.entries[next])) next = right;
      if (next === cursor) return;
      [this.entries[cursor], this.entries[next]] = [this.entries[next], this.entries[cursor]];
      cursor = next;
    }
  }
}
