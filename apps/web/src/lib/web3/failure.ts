export type RewardFailureKind = 'not-configured' | 'unreachable' | 'other'

export type RewardFailure = { kind: RewardFailureKind; message: string }

const NOT_CONFIGURED_HINTS = ['belum dikonfigurasi', 'chain_not_configured', 'chain_not_configured']
const UNREACHABLE_HINTS = ['failed to fetch', 'networkerror', 'load failed', 'permintaan gagal', 'fetch failed']

/**
 * The API client throws plain Errors, so the page has to tell "the backend answered that the
 * contract is unset" from "the backend never answered". Both must render as unavailable, and
 * neither may render as a success.
 */
export function classifyRewardFailure(error: unknown): RewardFailure {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lowered = message.toLowerCase()

  if (NOT_CONFIGURED_HINTS.some(hint => lowered.includes(hint))) {
    return { kind: 'not-configured', message }
  }
  if (error instanceof TypeError || UNREACHABLE_HINTS.some(hint => lowered.includes(hint))) {
    return { kind: 'unreachable', message: message || 'Backend tidak dapat dihubungi.' }
  }
  return { kind: 'other', message: message || 'Permintaan hadiah gagal.' }
}

/** An unconfigured contract or a dead backend are both "unavailable", never "claimed". */
export function isRewardSurfaceUnavailable(failure: RewardFailure): boolean {
  return failure.kind === 'not-configured' || failure.kind === 'unreachable'
}
