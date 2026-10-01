import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleWebhookRequest,
  type WebhookDependencies,
} from "@/lib/stripe/webhooks";

// A real Stripe client: signing and verifying webhooks is local crypto, no network calls.
const stripe = new Stripe("sk_test_unit_tests");
const webhookSecret = "whsec_unit_tests";

function accountUpdatedEvent(eventId: string, chargesEnabled: boolean) {
  return {
    id: eventId,
    object: "event",
    type: "account.updated",
    account: "acct_123",
    data: {
      object: {
        id: "acct_123",
        object: "account",
        charges_enabled: chargesEnabled,
      },
    },
  };
}

function signedRequest(event: object, secret = webhookSecret) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}

/** Fakes the database the way it really behaves: an event id can only be recorded once. */
function fakeDependencies(stripeSaysChargesEnabled: boolean) {
  const processedEventIds = new Set<string>();
  const stored = new Map<string, boolean>();
  const dependencies: WebhookDependencies = {
    retrieveAccount: vi.fn(async (accountId: string) => ({
      id: accountId,
      charges_enabled: stripeSaysChargesEnabled,
    })),
    applyAccountUpdated: vi.fn(
      async ({ eventId, accountId, chargesEnabled }) => {
        if (processedEventIds.has(eventId)) return false;
        processedEventIds.add(eventId);
        stored.set(accountId, chargesEnabled);
        return true;
      },
    ),
  };
  return { dependencies, stored };
}

function handle(request: Request, dependencies: WebhookDependencies) {
  return handleWebhookRequest(request, { stripe, webhookSecret, dependencies });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Stripe webhook", () => {
  it("applies account.updated using Stripe's current account, not the event payload", async () => {
    // The payload says payments are off, but by the time we handle it Stripe says they're on.
    const { dependencies, stored } = fakeDependencies(true);

    const response = await handle(
      signedRequest(accountUpdatedEvent("evt_1", false)),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: true,
      outcome: "applied",
    });
    expect(dependencies.retrieveAccount).toHaveBeenCalledWith("acct_123");
    expect(stored.get("acct_123")).toBe(true);
  });

  it("applies the same event only once when Stripe delivers it twice", async () => {
    const { dependencies } = fakeDependencies(true);
    const event = accountUpdatedEvent("evt_dup", true);

    const first = await handle(signedRequest(event), dependencies);
    const second = await handle(signedRequest(event), dependencies);

    expect(await first.json()).toMatchObject({ outcome: "applied" });
    // Still 200: the event was handled, so Stripe must stop retrying it.
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ outcome: "duplicate" });
  });

  it("acknowledges event types it doesn't handle without doing anything", async () => {
    const { dependencies } = fakeDependencies(true);
    const event = {
      ...accountUpdatedEvent("evt_other", true),
      type: "customer.created",
    };

    const response = await handle(signedRequest(event), dependencies);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "ignored" });
    expect(dependencies.retrieveAccount).not.toHaveBeenCalled();
    expect(dependencies.applyAccountUpdated).not.toHaveBeenCalled();
  });

  it("rejects a request signed with the wrong secret", async () => {
    const { dependencies } = fakeDependencies(true);

    const response = await handle(
      signedRequest(accountUpdatedEvent("evt_forged", true), "whsec_attacker"),
      dependencies,
    );

    expect(response.status).toBe(400);
    expect(dependencies.applyAccountUpdated).not.toHaveBeenCalled();
  });

  it("rejects a body that was changed after signing", async () => {
    const { dependencies } = fakeDependencies(true);
    const genuine = signedRequest(accountUpdatedEvent("evt_tampered", false));
    const tampered = new Request(genuine.url, {
      method: "POST",
      headers: genuine.headers,
      body: JSON.stringify(accountUpdatedEvent("evt_tampered", true)),
    });

    const response = await handle(tampered, dependencies);

    expect(response.status).toBe(400);
    expect(dependencies.applyAccountUpdated).not.toHaveBeenCalled();
  });

  it("rejects a request without a signature", async () => {
    const { dependencies } = fakeDependencies(true);
    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: JSON.stringify(accountUpdatedEvent("evt_unsigned", true)),
    });

    const response = await handle(request, dependencies);

    expect(response.status).toBe(400);
    expect(dependencies.applyAccountUpdated).not.toHaveBeenCalled();
  });

  it("answers 500 when processing fails, so Stripe retries later", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { dependencies } = fakeDependencies(true);
    dependencies.applyAccountUpdated = vi.fn(async () => {
      throw new Error("database unavailable");
    });

    const response = await handle(
      signedRequest(accountUpdatedEvent("evt_retry", true)),
      dependencies,
    );

    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalled();
  });
});
