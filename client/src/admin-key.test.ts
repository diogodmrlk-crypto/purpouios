import { describe, expect, it } from "vitest";

const API_URL = "https://69b9908ce69653ffe6a81689.mockapi.io/api/v1/Scy";

describe("admin key configuration", () => {
  it("sends the configured admin key to the MockAPI endpoint", async () => {
    const adminKey = process.env.VITE_ADMIN_KEY;
    expect(adminKey).toBeTruthy();

    const response = await fetch(API_URL, {
      headers: {
        "X-Admin-Key": adminKey ?? "",
      },
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toContain("application/json");
  }, 20_000);
});
