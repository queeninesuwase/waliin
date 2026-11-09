import { describe, expect, it } from "vitest";

import { checkPhotoFile, photoKey, squareCrop } from "./profilePhoto";

describe("profile photo", () => {
  it("keeps one photo per user", () => {
    expect(photoKey("u1")).toBe("waliin-photo-u1");
  });

  it("accepts common image types under 5 MB", () => {
    expect(checkPhotoFile({ type: "image/png", size: 1000 })).toBe("");
    expect(checkPhotoFile({ type: "image/jpeg", size: 1000 })).toBe("");
  });

  it("refuses other files and big images", () => {
    expect(checkPhotoFile({ type: "application/pdf", size: 1000 })).toBe(
      "Choose a PNG, JPG or WebP image.",
    );
    expect(checkPhotoFile({ type: "image/png", size: 6 * 1024 * 1024 })).toBe(
      "Choose an image smaller than 5 MB.",
    );
  });

  it("crops the middle square", () => {
    expect(squareCrop(400, 200)).toEqual({ x: 100, y: 0, side: 200 });
    expect(squareCrop(200, 300)).toEqual({ x: 0, y: 50, side: 200 });
  });
});
