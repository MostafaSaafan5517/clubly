import { appConfig } from "@/config/app";
import { formatDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import type { Json, Tables } from "@/lib/supabase/database.types";

export type AuditEntry = Pick<
  Tables<"audit_log">,
  | "actor"
  | "actor_user_id"
  | "table_name"
  | "action"
  | "changed_columns"
  | "old_data"
  | "new_data"
>;

/** Display names for the people an entry mentions. */
export type Names = {
  user: (userId: string) => string;
  member: (memberId: string) => string;
};

type Row = Record<string, unknown>;

function asRow(data: Json | null): Row {
  return data !== null && typeof data === "object" && !Array.isArray(data)
    ? data
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** The row as it is after the change (or as it was, for a delete). */
function currentRow(entry: AuditEntry) {
  return asRow(entry.action === "delete" ? entry.old_data : entry.new_data);
}

/** The users and memberships an entry mentions, so the page can look up their names at once. */
export function peopleIn(entries: AuditEntry[]) {
  const userIds = new Set<string>();
  const memberIds = new Set<string>();
  for (const entry of entries) {
    if (entry.actor_user_id) userIds.add(entry.actor_user_id);
    const row = currentRow(entry);
    if (
      entry.table_name === "business_staff" ||
      entry.table_name === "members"
    ) {
      if (text(row.user_id)) userIds.add(text(row.user_id));
    }
    if (
      entry.table_name === "subscriptions" ||
      entry.table_name === "payments"
    ) {
      if (text(row.member_id)) memberIds.add(text(row.member_id));
    }
  }
  return { userIds: [...userIds], memberIds: [...memberIds] };
}

/** Who made the change, as the business would say it. */
export function describeActor(entry: AuditEntry, names: Names) {
  switch (entry.actor) {
    case "user":
      return entry.actor_user_id ? names.user(entry.actor_user_id) : "Someone";
    case "stripe_webhook":
      return "Stripe";
    case "reconciliation":
      return "Daily check with Stripe";
    case "server":
      return appConfig.name;
    default:
      return "Database";
  }
}

function statusText(status: unknown) {
  return text(status).replaceAll("_", " ");
}

/** What changed, in a sentence. */
export function describeChange(entry: AuditEntry, names: Names): string {
  const before = asRow(entry.old_data);
  const after = asRow(entry.new_data);
  const row = currentRow(entry);
  const changed = new Set(entry.changed_columns);
  const inserted = entry.action === "insert";
  const deleted = entry.action === "delete";

  switch (entry.table_name) {
    case "businesses":
      if (inserted) return "Created the business";
      // The account id itself isn't stored (owners read this), but whether there is one is.
      if (changed.has("stripe_account_id")) {
        return after.has_stripe_account
          ? "Connected a Stripe account"
          : "Disconnected the Stripe account";
      }
      if (changed.has("charges_enabled")) {
        return after.charges_enabled
          ? "The business can now take payments"
          : "The business can no longer take payments";
      }
      if (changed.has("name")) {
        return `Renamed the business to "${text(after.name)}"`;
      }
      if (changed.has("stripe_portal_configuration_id")) {
        return "Set up the billing portal in Stripe";
      }
      break;

    case "business_staff": {
      const person = names.user(text(row.user_id));
      // Joining with an invite link, or leaving, is something people do to themselves. (So is
      // the owner's own row, which create_business adds along with the business.)
      const themselves = entry.actor_user_id === text(row.user_id);
      if (inserted) {
        return themselves && row.role !== "owner"
          ? `Joined as ${text(row.role)} with an invite link`
          : `Added ${person} as ${text(row.role)}`;
      }
      if (deleted) {
        return themselves
          ? `Left the business (${text(row.role)})`
          : `Removed ${person} (${text(row.role)})`;
      }
      if (changed.has("role")) {
        return `Changed ${person}'s role to ${text(after.role)}`;
      }
      break;
    }

    case "staff_invites": {
      const role = text(row.role);
      if (inserted) return `Created an invite link for a new ${role}`;
      if (deleted) return `Revoked an invite link for a new ${role}`;
      if (changed.has("accepted_by")) return `Used an invite link (${role})`;
      break;
    }

    case "plans": {
      const plan = `"${text(row.name)}"`;
      if (inserted) return `Created plan ${plan}`;
      if (deleted) return `Deleted plan ${plan}`;
      if (changed.has("active")) {
        return after.active ? `Restored plan ${plan}` : `Archived plan ${plan}`;
      }
      if (changed.has("stripe_price_id"))
        return `Set up plan ${plan} in Stripe`;
      if (changed.has("name")) {
        return `Renamed plan "${text(before.name)}" to ${plan}`;
      }
      break;
    }

    case "members": {
      const person = names.user(text(row.user_id));
      if (inserted) return `${person} joined`;
      if (changed.has("status")) {
        return after.status === "suspended"
          ? `Suspended ${person}`
          : `Reactivated ${person}`;
      }
      if (changed.has("stripe_customer_id")) {
        return `Set up ${person} as a customer in Stripe`;
      }
      break;
    }

    case "subscriptions": {
      const person = names.member(text(row.member_id));
      if (inserted) return `${person} subscribed (${statusText(row.status)})`;
      if (changed.has("status")) {
        return `${person}'s subscription is now ${statusText(after.status)}`;
      }
      if (changed.has("cancel_at")) {
        return after.cancel_at
          ? `${person}'s subscription will end on ${formatDate(text(after.cancel_at))}`
          : `${person} kept their subscription instead of ending it`;
      }
      if (changed.has("plan_id")) return `${person} switched plans`;
      if (changed.has("current_period_end")) {
        return `${person}'s subscription renewed`;
      }
      break;
    }

    case "payments": {
      const person = names.member(text(row.member_id));
      const amount = formatAmount(Number(row.amount), text(row.currency));
      return row.status === "paid"
        ? `${person} paid ${amount}`
        : `${person}'s payment of ${amount} failed`;
    }
  }

  return `Updated ${entry.table_name.replaceAll("_", " ")}: ${entry.changed_columns.join(", ")}`;
}
