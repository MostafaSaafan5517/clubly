import "server-only";
import { stripe } from "@/lib/stripe/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function storedConfigurationId(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("stripe_portal_configuration_id")
    .eq("id", businessId)
    .single();
  if (error) throw new Error(`Could not read the business: ${error.message}`);
  return data.stripe_portal_configuration_id;
}

/**
 * The Customer Portal configuration on the business's connected account, created on first use.
 * Express accounts have no dashboard settings of their own for the portal, so the platform
 * decides what members can do there.
 */
export async function getOrCreatePortalConfiguration(
  businessId: string,
  accountId: string,
) {
  const existing = await storedConfigurationId(businessId);
  if (existing) return existing;

  const configuration = await stripe.billingPortal.configurations.create(
    {
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        // Members keep what they paid for: canceling stops the next renewal.
        subscription_cancel: { enabled: true, mode: "at_period_end" },
        // A member's email is their sign-in, so it's changed in the app, not in Stripe.
        customer_update: { enabled: false },
      },
      metadata: { business_id: businessId },
    },
    {
      stripeAccount: accountId,
      idempotencyKey: `portal-configuration-${businessId}`,
    },
  );

  // Only fill an empty slot, so a racing request can never replace a stored configuration.
  const { error } = await supabaseAdmin
    .from("businesses")
    .update({ stripe_portal_configuration_id: configuration.id })
    .eq("id", businessId)
    .is("stripe_portal_configuration_id", null);
  if (error) {
    throw new Error(
      `Could not save the portal configuration: ${error.message}`,
    );
  }

  const stored = await storedConfigurationId(businessId);
  if (!stored) throw new Error("The portal configuration was not saved.");
  return stored;
}

const VIEW_ONLY_PURPOSE = "view-only";

/**
 * A portal configuration where members can see their plan and invoices but change nothing, for
 * the live demo's shared member accounts. Found by its metadata (only the demo business needs
 * one, so it isn't stored); two racing first visits may create two, which is harmless.
 */
export async function getOrCreateViewOnlyPortalConfiguration(
  accountId: string,
) {
  for await (const configuration of stripe.billingPortal.configurations.list(
    { active: true, limit: 100 },
    { stripeAccount: accountId },
  )) {
    if (configuration.metadata?.purpose === VIEW_ONLY_PURPOSE) {
      return configuration.id;
    }
  }
  const configuration = await stripe.billingPortal.configurations.create(
    {
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: false },
        subscription_cancel: { enabled: false },
        customer_update: { enabled: false },
      },
      metadata: { purpose: VIEW_ONLY_PURPOSE },
    },
    { stripeAccount: accountId },
  );
  return configuration.id;
}

/** A short-lived link to the Customer Portal, for a member's customer on the business's account. */
export async function createPortalUrl(options: {
  accountId: string;
  configurationId: string;
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: options.customerId,
      configuration: options.configurationId,
      return_url: options.returnUrl,
    },
    { stripeAccount: options.accountId },
  );
  return session.url;
}
