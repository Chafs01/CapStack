// Creates a Stripe Checkout session for the signed-in user.
//
// This runs on a server because the Stripe secret key cannot ship in a browser
// bundle — anyone holding it can charge cards and read customers. That is the
// whole reason this file exists rather than the checkout being called from the
// app directly.
//
// The caller's identity is taken from their Supabase JWT and never from the
// request body. A body that said "make user X a subscriber" would let anyone
// buy a plan for — or more usefully, attach a customer record to — somebody
// else's account.
//
// Deploy:
//   supabase functions deploy create-checkout-session
// Secrets it needs (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY      sk_live_… or sk_test_…
//   STRIPE_PRICE_PRO       price_… for the $10 plan
//   STRIPE_PRICE_PLUS      price_… for the $50 plan
//   SITE_URL               https://smartcapstack.com
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICES: Record<string, string | undefined> = {
  pro: Deno.env.get('STRIPE_PRICE_PRO'),
  plus: Deno.env.get('STRIPE_PRICE_PLUS'),
};

const SITE = Deno.env.get('SITE_URL') ?? 'https://smartcapstack.com';

const CORS = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Identity comes from the token, not the body.
    const auth = req.headers.get('Authorization') ?? '';
    const jwt = auth.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Not signed in' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: 'Not signed in' }, 401);

    const { plan } = await req.json().catch(() => ({ plan: 'pro' }));
    const price = PRICES[plan === 'plus' ? 'plus' : 'pro'];
    if (!price) return json({ error: 'That plan is not available yet.' }, 400);

    // Reuse the Stripe customer if this account already has one, so a second
    // subscription does not create a second customer record and split the
    // billing history in two.
    let customer = (user.user_metadata as Record<string, unknown> | null)?.stripe_customer_id as string | undefined;
    if (!customer) {
      const created = await stripe.customers.create({
        email: user.email ?? undefined,
        // The webhook reads this back to know whose plan to set. Stripe's own
        // customer id means nothing to Supabase on its own.
        metadata: { supabase_user_id: user.id },
      });
      customer = created.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price, quantity: 1 }],
      // Carried onto the subscription so the webhook can identify the account
      // even if the customer record is ever recreated.
      subscription_data: { metadata: { supabase_user_id: user.id } },
      client_reference_id: user.id,
      allow_promotion_codes: true,
      success_url: `${SITE}/account?checkout=success`,
      cancel_url: `${SITE}/pricing?checkout=cancelled`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error('checkout error', e);
    return json({ error: 'Could not start checkout.' }, 500);
  }
});
