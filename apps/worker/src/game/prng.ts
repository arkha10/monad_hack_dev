export interface Rng {
  next(): number
  int(maxExclusive: number): number
  range(min: number, max: number): number
  angleRadians(): number
  pick<T>(items: readonly T[]): T
}

function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed) || 1
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: maxExclusive => Math.floor(next() * maxExclusive),
    range: (min, max) => min + next() * (max - min),
    angleRadians: () => next() * Math.PI * 2,
    pick: items => items[Math.floor(next() * items.length)],
  }
}
