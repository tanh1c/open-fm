import { describe, expect, it } from "vitest";
import {
  getRenewalStatusClassName,
  getRenewalStatusMessage,
  shouldDisableRenewalSubmit,
} from "./PlayerProfile.renewal";

const t = (key: string, params?: Record<string, string | number>): string => {
  if (key === "playerProfile.renewalBlocked") {
    return "Talks blocked";
  }

  if (key === "playerProfile.renewalAccepted") {
    return "Offer accepted";
  }

  if (key === "playerProfile.renewalRejected") {
    return "Offer rejected";
  }

  if (key === "playerProfile.renewalCounter") {
    return `Counter ${params?.wage}/${params?.years}`;
  }

  return key;
};

describe("PlayerProfile renewal helpers", () => {
  it("prefers the blocked message when the session is blocked", () => {
    expect(
      getRenewalStatusMessage(
        {
          renewalSessionStatus: "blocked",
          renewalStatus: "idle",
          renewalSuggestedWage: null,
          renewalSuggestedYears: null,
          renewalError: "raw error",
        },
        t,
      ),
    ).toBe("Talks blocked");
  });

  it("formats counter-offer messaging with suggested terms", () => {
    expect(
      getRenewalStatusMessage(
        {
          renewalSessionStatus: "open",
          renewalStatus: "counter_offer",
          renewalSuggestedWage: 16000,
          renewalSuggestedYears: 4,
          renewalError: null,
        },
        t,
      ),
    ).toBe("Counter 16000/4");
  });

  it("falls back to the raw error when no translated state applies", () => {
    expect(
      getRenewalStatusMessage(
        {
          renewalSessionStatus: "idle",
          renewalStatus: "error",
          renewalSuggestedWage: null,
          renewalSuggestedYears: null,
          renewalError: "backend timeout",
        },
        t,
      ),
    ).toBe("backend timeout");
  });

  it("maps renewal statuses to their display class names", () => {
    expect(getRenewalStatusClassName("accepted")).toBe("text-primary-500");
    expect(getRenewalStatusClassName("rejected")).toBe("text-red-500");
    expect(getRenewalStatusClassName("counter_offer")).toBe(
      "text-accent-600 dark:text-accent-400",
    );
    expect(getRenewalStatusClassName("idle")).toBe(
      "text-gray-500 dark:text-gray-400",
    );
  });

  it("disables submit when any blocking condition is present", () => {
    expect(
      shouldDisableRenewalSubmit({
        renewalSubmitting: false,
        renewalIsTerminal: false,
        isRenewalWageValid: true,
        isRenewalLengthValid: true,
        renewalViolatesSoftCap: false,
      }),
    ).toBe(false);

    expect(
      shouldDisableRenewalSubmit({
        renewalSubmitting: false,
        renewalIsTerminal: false,
        isRenewalWageValid: true,
        isRenewalLengthValid: true,
        renewalViolatesSoftCap: true,
      }),
    ).toBe(true);
  });
});