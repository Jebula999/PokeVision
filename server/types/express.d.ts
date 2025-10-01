import type { DiscordAuthUser } from "../auth";

declare global {
  namespace Express {
    // Passport augments Request#user with this interface
    interface User extends DiscordAuthUser {}
  }
}

export {};
