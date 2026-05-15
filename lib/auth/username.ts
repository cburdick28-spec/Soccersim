export const USERNAME_DOMAIN = "pocketmanager.local";

export const normalizeUsername = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "");

export const usernameToEmail = (username: string) => {
  const normalized = normalizeUsername(username);
  return `${normalized}@${USERNAME_DOMAIN}`;
};

export const isGlobalAdmin = (username: string) =>
  normalizeUsername(username) === "connorb";
