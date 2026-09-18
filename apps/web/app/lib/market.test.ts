import { describe, expect, it } from "vitest";

import { marketClosedCopy, marketView } from "./market";

describe("marketClosedCopy", () => {
  it("names the exchange, the reason and the next bell in Eastern time", () => {
    expect(marketClosedCopy(marketView("ca", new Date("2026-09-17T21:00:00Z")))).toBe(
      "The TSX has closed for the day. Orders open again Fri, Sep 18, 9:30 a.m. ET.",
    );
    expect(marketClosedCopy(marketView("us", new Date("2026-09-19T15:00:00Z")))).toBe(
      "The NYSE is closed for the weekend. Orders open again Mon, Sep 21, 9:30 a.m. ET.",
    );
    expect(marketClosedCopy(marketView("ca", new Date("2026-10-12T15:00:00Z")))).toBe(
      "The TSX is closed for Thanksgiving. Orders open again Tue, Oct 13, 9:30 a.m. ET.",
    );
    expect(marketClosedCopy(marketView("us", new Date("2026-09-17T12:00:00Z")))).toBe(
      "The NYSE has not opened yet. Orders open Thu, Sep 17, 9:30 a.m. ET.",
    );
  });

  it("is open mid-session", () => {
    expect(marketView("ca", new Date("2026-09-17T15:00:00Z")).open).toBe(true);
  });
});
