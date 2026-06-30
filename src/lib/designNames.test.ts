import { describe, expect, it } from "vitest";
import { validateDisplayName } from "./designNames";

describe("validateDisplayName", () => {
  it("accepts normal names", () => {
    expect(validateDisplayName("Client Flow")).toBeNull();
  });

  it("rejects empty and path-like names", () => {
    expect(validateDisplayName("")).toBe("Enter a name.");
    expect(validateDisplayName("../bad")).toBe(
      "Names cannot contain path separators or colons.",
    );
    expect(validateDisplayName("bad:name")).toBe(
      "Names cannot contain path separators or colons.",
    );
  });
});
