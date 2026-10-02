export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Run `fn` every `ms` without overlapping runs; errors are reported, never thrown. */
export function every(ms: number, fn: () => Promise<void>, onError: (e: unknown) => void, initialDelay = 0) {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  const tick = async () => {
    if (stopped) return;
    try {
      await fn();
    } catch (e) {
      onError(e);
    }
    if (!stopped) timer = setTimeout(tick, ms);
  };
  timer = setTimeout(tick, initialDelay);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

/** Serialises async work per key (e.g. per WhatsApp account). */
export class KeyedQueue {
  private tails = new Map<string, Promise<unknown>>();
  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    const tail = next.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return next;
  }
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const nowIso = () => new Date().toISOString();
