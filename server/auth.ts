import type { Express } from "express";
import session from "express-session";
import passport from "passport";
import memorystore from "memorystore";
import { Strategy as DiscordStrategy, type Profile as DiscordProfile } from "passport-discord";

export interface DiscordAuthUser {
  id: string;
  username: string;
  discriminator?: string;
  globalName?: string | null;
  avatar?: string | null;
}

const userStore = new Map<string, DiscordAuthUser>();
const MemoryStore = memorystore(session);

function getDiscordCallbackUrl(): string {
  const explicitUrl = process.env.DISCORD_REDIRECT_URI;
  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (baseUrl) {
    return new URL("/auth/discord/callback", baseUrl).toString();
  }

  const port = process.env.PORT ?? "4000";
  return `http://localhost:${port}/auth/discord/callback`;
}

function normalizeProfile(profile: DiscordProfile): DiscordAuthUser {
  return {
    id: profile.id,
    username: profile.username,
    discriminator: (profile as any).discriminator ?? undefined,
    globalName: (profile as any).global_name ?? profile.displayName ?? null,
    avatar: profile.avatar ?? null,
  };
}

export function setupAuth(app: Express): void {
  const clientID = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;
  const sessionTtlMs = Number(process.env.SESSION_TTL_MS ?? 86_400_000);
  const sessionCookieMaxAgeMs = Number(process.env.SESSION_COOKIE_MAX_AGE_MS ?? sessionTtlMs);

  const sessionStore = new MemoryStore({
    checkPeriod: Math.max(60_000, Math.floor(sessionTtlMs / 2)),
    ttl: Math.max(1, Math.floor(sessionTtlMs / 1000)),
  });

  if (!clientID || !clientSecret) {
    throw new Error("Discord OAuth configuration missing. Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.");
  }

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET is required to enable Discord authentication.");
  }

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: app.get("env") === "production",
      sameSite: "lax",
      httpOnly: true,
      maxAge: sessionCookieMaxAgeMs,
    },
  }));

  passport.serializeUser((user: DiscordAuthUser, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id: string, done) => {
    const user = userStore.get(id);
    done(null, user ?? null);
  });

  passport.use(
    new DiscordStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: getDiscordCallbackUrl(),
        scope: ["identify"],
      },
      (_accessToken, _refreshToken, profile, done) => {
        const user = normalizeProfile(profile);
        userStore.set(user.id, user);
        done(null, user);
      },
    ),
  );

  app.use(passport.initialize());
  app.use(passport.session());
}
