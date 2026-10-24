export const ROUTE_OWNERSHIP = {
  "/": "A",
  "/auth/callback": "A",
  "/team": "A",
  "/practice": "A",
  "/queue": "A",
  "/match/:matchId": "A",
  "/results/:matchId": "A",
  "/leaderboard": "A",
  "/shop": "A",
  "/profile": "A",
  "/wallet": "C",
  "/rewards": "C",
} as const;

export type RoutePath = keyof typeof ROUTE_OWNERSHIP;
