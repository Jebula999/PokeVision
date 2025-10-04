import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface DiscordSessionUser {
  id: string;
  username: string;
  discriminator?: string | null;
  globalName?: string | null;
  avatar?: string | null;
}

interface AuthSessionResponse {
  authenticated: boolean;
  user?: DiscordSessionUser;
}

async function fetchDiscordSession(): Promise<AuthSessionResponse> {
  const response = await fetch("/api/auth/session", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Session request failed with status ${response.status}`);
  }

  return response.json() as Promise<AuthSessionResponse>;
}

export function useDiscordSession() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["discord-session"],
    queryFn: fetchDiscordSession,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["discord-session"] });
  };

  return { ...query, invalidate };
}

