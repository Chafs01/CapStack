// Stripe tells us here when a subscription starts, changes, or ends, and this
// is the only thing that writes `plan` onto a user.
//
// It is deliberately the sole writer. If the app could set its own plan, the
// paywall would be a suggestion — the bundle ships to the browser and anyone
// could call that endpoint. Stripe's signature is what makes this trustworthy,
// so an unverified request is rejected before anything is read from it.
//
// Deploy (note --no-verify-jwt: Stripe does not carry a Supabase token, and
// the signature check below is what authenticates the caller instead):
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET       whsec_… from the endpoint in the Stripe dashboard
//   STRIPE_PRICE_PRO            price_… so a subscription can be mapped to a tier
//   STRIPE_PRICE_PLUS           price_…
//   SUPABASE_SERVICE_ROLE_KEY   required: changing another user's metadata is
//                               not something the anon key may do, by design
//
// Events to select on the endpoint:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const PRICE_PRO = Deno.env.get('STRIPE_PRICE_PRO') ?? '';
const PRICE_PLUS = Deno.env.get('STRIPE_PRICE_PLUS') ?? '';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

// Which tier a subscription represents. Unknown prices resolve to free rather
// than guessing upward — mislabelling a $10 subscriber as $50 gives away the
// thing being sold, and the reverse is at least visible to the customer.
function tierOf(sub: Stripe.Subscription): 'free' | 'pro' | 'plus' {
  const active = sub.status === 'active' || sub.status === 'trialing';
  if (!active) return 'free';
  for (const item of sub.items?.data ?? []) {
    const id = item.price?.id;
    if (id && id === PRICE_PLUS) return 'plus';
    if (id && id === PRICE_PRO) return 'pro';
  }
  return 'free';
}

// The account this subscription belongs to. The metadata we stamped at
// checkout is authoritative; the customer record is the fallback for
// subscriptions created by hand in the Stripe dashboard.
async function userIdFor(sub: Stripe.Subscription): Promise<string | null> {
  const fromSub = sub.metadata?.supabase_user_id;
  if (fromSub) return fromSub;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  if (!customerId) return null;
  try {
    const cust = await stripe.customers.retrieve(customerId);
    if (!cust || (cust as Stripe.DeletedCustomer).deleted) return null;
    return (cust as Stripe.Customer).metadata?.supabase_user_id ?? null;
  } catch {
    return null;
  }
}

async function setPlan(userId: string, tier: string, customerId?: string) {
  // Read first so this never clobbers the display name, the branding, or
  // anything else living in the same metadata object.
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user) throw new Error(`no such user ${userId}`);
  const meta = { ...(data.user.user_metadata ?? {}), plan: tier };
  if (customerId) meta.stripe_customer_id = customerId;
  const { error: upErr } = await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
  if (upErr) throw upErr;
  console.log(`plan ${tier} for ${userId}`);
}

Deno.serve(async (req) => {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing signature', { status: 400 });

  // The raw body is required — parsing it first would break the signature.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, WEBHOOK_SECRET);
  } catch (e) {
    console.error('bad signature', e);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = (s.client_reference_id as string | null) ?? null;
        const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
        // The subscription event that follows carries the price and sets the
        // tier; this pass exists to record the customer id so the billing
        // portal can find them later.
        if (userId && customerId) {
          const { data } = await admin.auth.admin.getUserById(userId);
          const meta = { ...(data?.user?.user_metadata ?? {}), stripe_customer_id: customerId };
          await admin.auth.admin.updateUserById(userId, { user_metadata: meta });
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await userIdFor(sub);
        if (!userId) { console.error('no supabase user on', sub.id); break; }
        // A deleted subscription is free regardless of what its items say.
        const tier = event.type === 'customer.subscription.deleted' ? 'free' : tierOf(sub);
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        await setPlan(userId, tier, customerId);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    console.error('webhook handling failed', event.type, e);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
