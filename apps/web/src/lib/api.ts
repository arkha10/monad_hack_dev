import type { BoaiDataLayer } from "@boai/shared/contracts";
import type { Difficulty, TeamId, CoachCommand } from "@boai/shared/types";
import { getSession } from "./auth";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; requestId: string }> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (session?.token)
    headers.set("authorization", `Bearer ${session.token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const body = (await response.json()) as {
    data?: T;
    requestId?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.data)
    throw new Error(
      body.error?.message ?? `Permintaan gagal (${response.status})`,
    );
  return { data: body.data, requestId: body.requestId ?? "unknown" };
}

export const api: BoaiDataLayer = {
  syncIdentity: () => request("/api/v1/identity/sync", { method: "POST" }),
  register: (username, password) =>
    request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username, password) =>
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getTeam: () => request("/api/v1/team"),
  saveTeam: (team) =>
    request("/api/v1/team", { method: "PUT", body: JSON.stringify(team) }),
  startPractice: (difficulty: Difficulty, teamId: TeamId) =>
    request("/api/v1/practice/start", {
      method: "POST",
      body: JSON.stringify({ difficulty, teamId }),
    }),
  joinQueue: (teamId, stakeCredits) =>
    request("/api/v1/queue/join", {
      method: "POST",
      body: JSON.stringify({ teamId, stakeCredits }),
    }),
  getQueueStatus: (ticket) =>
    request(`/api/v1/queue/status?queueTicket=${encodeURIComponent(ticket)}`),
  leaveQueue: (ticket) =>
    request("/api/v1/queue/leave", {
      method: "POST",
      body: JSON.stringify({ queueTicket: ticket }),
    }),
  getMatch: (matchId) => request(`/api/v1/matches/${matchId}`),
  getMatchEvents: (matchId, afterSeq) =>
    request(`/api/v1/matches/${matchId}/events?afterSeq=${afterSeq}`),
  createMatchSocketTicket: (matchId) =>
    request(`/api/v1/matches/${matchId}/ws-ticket`, { method: "POST" }),
  sendCoach: (matchId, command: CoachCommand) =>
    request(`/api/v1/matches/${matchId}/coach`, {
      method: "POST",
      body: JSON.stringify({ command }),
    }),
  getResult: (matchId) => request(`/api/v1/results/${matchId}`),
  getCredits: () => request("/api/v1/credits"),
  listCosmetics: () => request("/api/v1/shop/items"),
  purchaseCosmetic: (cosmeticId) =>
    request("/api/v1/shop/purchase", {
      method: "POST",
      body: JSON.stringify({ cosmeticId }),
    }),
  claimDemoAdReward: () =>
    request("/api/v1/rewards/ad-demo", { method: "POST" }),
  getLeaderboard: () => request("/api/v1/leaderboard"),
  requestWalletNonce: (address) =>
    request("/api/v1/wallet/nonce", {
      method: "POST",
      body: JSON.stringify({ address }),
    }),
  linkWallet: (address, signature) =>
    request("/api/v1/wallet/link", {
      method: "POST",
      body: JSON.stringify({ address, signature }),
    }),
  getRewardEligibility: (matchId) =>
    request(`/api/v1/chain/rewards/${matchId}`),
  claimTestnetReward: (matchId) =>
    request("/api/v1/chain/reward-claim", {
      method: "POST",
      body: JSON.stringify({ matchId }),
    }),
};
