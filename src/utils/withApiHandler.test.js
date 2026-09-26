import { beforeEach, describe, expect, it, vi } from "vitest";
import withApiHandler from "./withApiHandler";
import { showGlobalMessage } from "@/contexts/MessageContext";

vi.mock("@/contexts/MessageContext", () => ({
  showGlobalMessage: vi.fn(),
}));

describe("withApiHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("silently returns cancellation state for an aborted request", async () => {
    const request = withApiHandler(async () => {
      const error = new Error("canceled");
      error.name = "CanceledError";
      error.code = "ERR_CANCELED";
      throw error;
    });

    await expect(request()).resolves.toEqual({ error: true, canceled: true });
    expect(showGlobalMessage).not.toHaveBeenCalled();
  });

  it("continues showing genuine request failures", async () => {
    const request = withApiHandler(async () => {
      throw new Error("Request failed");
    });

    await expect(request()).resolves.toEqual({
      error: true,
      message: "Request failed",
      status: undefined,
    });
    expect(showGlobalMessage).toHaveBeenCalledWith("Request failed", "error");
  });
});
