import { describe, expect, it } from "vitest";
import {
  type AuditEntry,
  describeActor,
  describeChange,
  peopleIn,
} from "@/lib/audit";

const names = {
  user: (id: string) =>
    ({ u_owner: "Olive Owner", u_mona: "Mona Member" })[id] ?? "Someone",
  member: (id: string) => ({ m_mona: "Mona Member" })[id] ?? "A member",
};

function entry(overrides: Partial<AuditEntry>): AuditEntry {
  return {
    actor: "user",
    actor_user_id: "u_owner",
    table_name: "plans",
    action: "update",
    changed_columns: [],
    old_data: null,
    new_data: null,
    ...overrides,
  };
}

describe("describeActor", () => {
  it("names the signed-in user, or the system that made the change", () => {
    expect(describeActor(entry({}), names)).toBe("Olive Owner");
    expect(describeActor(entry({ actor: "stripe_webhook" }), names)).toBe(
      "Stripe",
    );
    expect(describeActor(entry({ actor: "reconciliation" }), names)).toBe(
      "Daily check with Stripe",
    );
    expect(describeActor(entry({ actor: "server" }), names)).toBe("Clubly");
    expect(describeActor(entry({ actor: "database" }), names)).toBe("Database");
  });

  it("falls back when the user isn't known", () => {
    expect(describeActor(entry({ actor_user_id: null }), names)).toBe(
      "Someone",
    );
    expect(describeActor(entry({ actor_user_id: "u_gone" }), names)).toBe(
      "Someone",
    );
  });
});

describe("describeChange", () => {
  it("describes the business itself", () => {
    expect(
      describeChange(
        entry({ table_name: "businesses", action: "insert" }),
        names,
      ),
    ).toBe("Created the business");
    expect(
      describeChange(
        entry({
          table_name: "businesses",
          changed_columns: ["charges_enabled"],
          new_data: { charges_enabled: true },
        }),
        names,
      ),
    ).toBe("The business can now take payments");
    expect(
      describeChange(
        entry({
          table_name: "businesses",
          changed_columns: ["has_stripe_account", "stripe_account_id"],
          new_data: { has_stripe_account: true },
        }),
        names,
      ),
    ).toBe("Connected a Stripe account");
    expect(
      describeChange(
        entry({
          table_name: "businesses",
          changed_columns: ["has_stripe_account", "stripe_account_id"],
          new_data: { has_stripe_account: false },
        }),
        names,
      ),
    ).toBe("Disconnected the Stripe account");
  });

  it("describes staff joining, leaving and changing role", () => {
    const staff = { user_id: "u_mona", role: "staff" };
    expect(
      describeChange(
        entry({
          table_name: "business_staff",
          action: "insert",
          new_data: staff,
        }),
        names,
      ),
    ).toBe("Added Mona Member as staff");
    expect(
      describeChange(
        entry({
          table_name: "business_staff",
          action: "delete",
          old_data: staff,
        }),
        names,
      ),
    ).toBe("Removed Mona Member (staff)");
    expect(
      describeChange(
        entry({
          table_name: "business_staff",
          changed_columns: ["role"],
          old_data: staff,
          new_data: { ...staff, role: "admin" },
        }),
        names,
      ),
    ).toBe("Changed Mona Member's role to admin");
  });

  it("describes plans being created, archived, restored and priced", () => {
    const plan = { name: "Gold", active: true };
    expect(
      describeChange(entry({ action: "insert", new_data: plan }), names),
    ).toBe('Created plan "Gold"');
    expect(
      describeChange(
        entry({
          changed_columns: ["active"],
          old_data: plan,
          new_data: { ...plan, active: false },
        }),
        names,
      ),
    ).toBe('Archived plan "Gold"');
    expect(
      describeChange(
        entry({ changed_columns: ["active"], new_data: plan }),
        names,
      ),
    ).toBe('Restored plan "Gold"');
    expect(
      describeChange(
        entry({
          changed_columns: ["has_stripe_price", "stripe_price_id"],
          new_data: plan,
        }),
        names,
      ),
    ).toBe('Set up plan "Gold" in Stripe');
  });

  it("describes members joining and being suspended or reactivated", () => {
    const member = { user_id: "u_mona", status: "active" };
    expect(
      describeChange(
        entry({ table_name: "members", action: "insert", new_data: member }),
        names,
      ),
    ).toBe("Mona Member joined");
    expect(
      describeChange(
        entry({
          table_name: "members",
          changed_columns: ["status"],
          new_data: { ...member, status: "suspended" },
        }),
        names,
      ),
    ).toBe("Suspended Mona Member");
    expect(
      describeChange(
        entry({
          table_name: "members",
          changed_columns: ["status"],
          new_data: member,
        }),
        names,
      ),
    ).toBe("Reactivated Mona Member");
  });

  it("describes subscriptions changing", () => {
    const subscription = {
      member_id: "m_mona",
      status: "active",
      cancel_at: null,
    };
    expect(
      describeChange(
        entry({
          table_name: "subscriptions",
          action: "insert",
          new_data: subscription,
        }),
        names,
      ),
    ).toBe("Mona Member subscribed (active)");
    expect(
      describeChange(
        entry({
          table_name: "subscriptions",
          changed_columns: ["status"],
          new_data: { ...subscription, status: "past_due" },
        }),
        names,
      ),
    ).toBe("Mona Member's subscription is now past due");
    expect(
      describeChange(
        entry({
          table_name: "subscriptions",
          changed_columns: ["cancel_at"],
          new_data: { ...subscription, cancel_at: "2026-11-01T12:00:00+00:00" },
        }),
        names,
      ),
    ).toBe("Mona Member's subscription will end on November 1, 2026");
    expect(
      describeChange(
        entry({
          table_name: "subscriptions",
          changed_columns: ["cancel_at"],
          new_data: subscription,
        }),
        names,
      ),
    ).toBe("Mona Member kept their subscription instead of ending it");
  });

  it("describes payments, paid or failed", () => {
    const payment = {
      member_id: "m_mona",
      amount: 3000,
      currency: "usd",
      status: "paid",
    };
    expect(
      describeChange(
        entry({ table_name: "payments", action: "insert", new_data: payment }),
        names,
      ),
    ).toBe("Mona Member paid $30.00");
    expect(
      describeChange(
        entry({
          table_name: "payments",
          action: "insert",
          new_data: { ...payment, status: "failed" },
        }),
        names,
      ),
    ).toBe("Mona Member's payment of $30.00 failed");
  });

  it("falls back to the changed columns for anything else", () => {
    expect(
      describeChange(
        entry({
          table_name: "plans",
          changed_columns: ["amount", "currency"],
          new_data: {},
        }),
        names,
      ),
    ).toBe("Updated plans: amount, currency");
  });
});

describe("peopleIn", () => {
  it("collects the users and memberships the entries mention, once each", () => {
    expect(
      peopleIn([
        entry({ actor_user_id: "u_owner" }),
        entry({
          table_name: "members",
          action: "insert",
          new_data: { user_id: "u_mona" },
        }),
        entry({
          table_name: "business_staff",
          action: "delete",
          old_data: { user_id: "u_owner" },
        }),
        entry({
          actor: "stripe_webhook",
          actor_user_id: null,
          table_name: "payments",
          new_data: { member_id: "m_mona" },
        }),
        entry({
          actor: "stripe_webhook",
          actor_user_id: null,
          table_name: "subscriptions",
          new_data: { member_id: "m_mona" },
        }),
      ]),
    ).toEqual({ userIds: ["u_owner", "u_mona"], memberIds: ["m_mona"] });
  });
});
