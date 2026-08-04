// Opens Stripe's billing portal for the signed-in user: change card, switch
// plan, cancel, download invoices.
//
// Building any of that ourselves would mean handling card details, which is
// both a large amount of work and a compliance burden worth avoiding entirely.
// Stripe hosts the whole thing; this endpoint only proves who is asking.
//
// Deploy:
//   supabase functions deploy billing-portal
// Secrets: STRIPE_SECRET_KEY, SITE_URL
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});
const SITE = Deno.env.get('SITE_URL') ?? 'https://smartcapstack.com';
const CORS = {
  'Access-Control-Allow-Origin': SITE,
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'Not signed in' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: 'Not signed in' }, 401);

    // Whose billing this is comes from their own record, never from the
    // request — otherwise anyone could open anyone else's portal.
    const customer = (user.user_metadata as Record<string, unknown> | null)?.stripe_customer_id as string | undefined;
    if (!customer) return json({ error: 'No billing record for this account yet.' }, 400);

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${SITE}/account`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error('portal error', e);
    return json({ error: 'Could not open the billing portal.' }, 500);
  }
});
