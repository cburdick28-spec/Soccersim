import { describe, expect, test } from "vitest";
import { isGlobalAdmin, normalizeUsername, usernameToEmail } from "./username";

describe("username auth mapping", () => {
  test("maps username to internal local-domain email", () => {
    expect(usernameToEmail(" ConnorB ")).toBe("connorb@pocketmanager.local");
  });

  test("detects global admin user", () => {
    expect(isGlobalAdmin("ConnorB")).toBe(true);
    expect(isGlobalAdmin("anotherUser")).toBe(false);
    expect(normalizeUsername(" User Name ")).toBe("username");
  });
});
