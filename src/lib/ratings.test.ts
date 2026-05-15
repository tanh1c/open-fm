import { describe, it, expect } from "vitest";
import { ratingClass } from "./ratings";

describe("ratingClass", () => {
  it("returns elite class for 85+", () => {
    expect(ratingClass(85)).toBe("rating-cell-elite");
    expect(ratingClass(99)).toBe("rating-cell-elite");
  });

  it("returns good class for 70-84", () => {
    expect(ratingClass(70)).toBe("rating-cell-good");
    expect(ratingClass(84)).toBe("rating-cell-good");
  });

  it("returns avg class for 50-69", () => {
    expect(ratingClass(50)).toBe("rating-cell-avg");
    expect(ratingClass(69)).toBe("rating-cell-avg");
  });

  it("returns poor class below 50", () => {
    expect(ratingClass(0)).toBe("rating-cell-poor");
    expect(ratingClass(49)).toBe("rating-cell-poor");
  });
});
