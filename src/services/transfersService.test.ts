import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";

import {
  counterOffer,
  makeTransferBid,
  previewTransferBidFinancialImpact,
  respondToOffer,
} from "./transfersService";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

describe("transfersService", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("calls the make transfer bid backend command", async () => {
    const response = { decision: "accepted" };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(makeTransferBid("player-1", 1500000)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("make_transfer_bid", {
      playerId: "player-1",
      fee: 1500000,
    });
  });

  it("calls the respond to offer backend command", async () => {
    const response = { manager: { id: "manager-1" } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(respondToOffer("player-1", "offer-1", true)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("respond_to_offer", {
      playerId: "player-1",
      offerId: "offer-1",
      accept: true,
    });
  });

  it("calls the counter offer backend command", async () => {
    const response = { decision: "counter_offer" };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(counterOffer("player-1", "offer-1", 1800000)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("counter_offer", {
      playerId: "player-1",
      offerId: "offer-1",
      requestedFee: 1800000,
    });
  });

  it("calls the transfer bid projection backend command", async () => {
    const response = { projection: { transfer_budget_before: 0 } };
    mockedInvoke.mockResolvedValueOnce(response);

    await expect(previewTransferBidFinancialImpact("player-1", 1000000)).resolves.toBe(response);
    expect(mockedInvoke).toHaveBeenCalledWith("preview_transfer_bid_financial_impact", {
      playerId: "player-1",
      fee: 1000000,
    });
  });
});