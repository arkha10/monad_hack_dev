export interface CurrentUser {
  userId: string;
  username: string | null;
  displayName: string;
  isGuest: boolean;
  token?: string | null;
}

const STORAGE_KEY = "boai_user_session";

export function getStoredUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: CurrentUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota
  }
}

export async function register(
  username: string,
  password: string,
): Promise<CurrentUser> {
  const response = await fetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json()) as {
    data?: { user: CurrentUser; token: string };
    error?: { message?: string };
  };
  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? "Pendaftaran gagal");
  }
  const user: CurrentUser = {
    ...body.data.user,
    token: body.data.token,
  };
  setStoredUser(user);
  return user;
}

export async function login(
  username: string,
  password: string,
): Promise<CurrentUser> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json()) as {
    data?: { user: CurrentUser; token: string };
    error?: { message?: string };
  };
  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? "Login gagal");
  }
  const user: CurrentUser = {
    ...body.data.user,
    token: body.data.token,
  };
  setStoredUser(user);
  return user;
}

export async function guestLogin(): Promise<CurrentUser> {
  const response = await fetch("/api/v1/identity/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
  });
  const body = (await response.json()) as {
    data?: CurrentUser;
    error?: { message?: string };
  };
  if (!response.ok || !body.data) {
    throw new Error(body.error?.message ?? "Sesi guest gagal dibuat");
  }
  const user: CurrentUser = {
    ...body.data,
    isGuest: true,
    username: null,
  };
  setStoredUser(user);
  return user;
}

export async function getSession(): Promise<CurrentUser | null> {
  const stored = getStoredUser();
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (stored?.token) {
      headers["authorization"] = `Bearer ${stored.token}`;
    }
    const response = await fetch("/api/v1/identity/sync", {
      method: "POST",
      headers,
      credentials: "same-origin",
    });
    if (!response.ok) {
      setStoredUser(null);
      return null;
    }
    const body = (await response.json()) as { data?: CurrentUser };
    if (body.data) {
      const user: CurrentUser = {
        userId: body.data.userId,
        username: body.data.username ?? stored?.username ?? null,
        displayName: body.data.displayName,
        isGuest: body.data.isGuest,
        token: stored?.token ?? null,
      };
      setStoredUser(user);
      return user;
    }
  } catch {
    return stored;
  }
  return stored;
}

export async function signOut(): Promise<void> {
  setStoredUser(null);
  try {
    await fetch("/api/v1/identity/signout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    // Ignore error
  }
}
