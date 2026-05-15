/**
 * Map a 0-100 player attribute or rating to a CSS class that color-grades the
 * cell. The class names match utilities defined in App.css's @layer utilities
 * block.
 */
export type RatingClass =
  | "rating-cell-elite"
  | "rating-cell-good"
  | "rating-cell-avg"
  | "rating-cell-poor";

export function ratingClass(value: number): RatingClass {
  if (value >= 85) return "rating-cell-elite";
  if (value >= 70) return "rating-cell-good";
  if (value >= 50) return "rating-cell-avg";
  return "rating-cell-poor";
}
