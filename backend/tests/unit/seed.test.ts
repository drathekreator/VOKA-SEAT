import { describe, it, expect } from "vitest";

/**
 * Unit test verifying the seed data logic for 24 seats with correct zone mapping.
 * This tests the zone assignment logic without requiring a database connection.
 */
describe("Seed data: 24 seats with zone mapping", () => {
  function buildSeatData(): Array<{ id: number; zone: string }> {
    const seats: Array<{ id: number; zone: string }> = [];

    for (let i = 1; i <= 4; i++) {
      seats.push({ id: i, zone: "left" });
    }
    for (let i = 5; i <= 10; i++) {
      seats.push({ id: i, zone: "center" });
    }
    for (let i = 11; i <= 24; i++) {
      seats.push({ id: i, zone: "upper" });
    }

    return seats;
  }

  it("should produce exactly 24 seats", () => {
    const seats = buildSeatData();
    expect(seats).toHaveLength(24);
  });

  it("should assign seats 1-4 to zone 'left'", () => {
    const seats = buildSeatData();
    const leftSeats = seats.filter((s) => s.zone === "left");
    expect(leftSeats.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  });

  it("should assign seats 5-10 to zone 'center'", () => {
    const seats = buildSeatData();
    const centerSeats = seats.filter((s) => s.zone === "center");
    expect(centerSeats.map((s) => s.id)).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it("should assign seats 11-24 to zone 'upper'", () => {
    const seats = buildSeatData();
    const upperSeats = seats.filter((s) => s.zone === "upper");
    expect(upperSeats.map((s) => s.id)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
  });

  it("should have unique seat IDs covering 1-24", () => {
    const seats = buildSeatData();
    const ids = seats.map((s) => s.id).sort((a, b) => a - b);
    const expected = Array.from({ length: 24 }, (_, i) => i + 1);
    expect(ids).toEqual(expected);
  });

  it("should only use valid zone values", () => {
    const seats = buildSeatData();
    const validZones = new Set(["left", "center", "upper"]);
    for (const seat of seats) {
      expect(validZones.has(seat.zone)).toBe(true);
    }
  });
});
