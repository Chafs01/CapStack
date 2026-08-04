# Turning the paywall on

Everything in the app is built. What is left is the part only you can do: an
account with Stripe, and telling Supabase the secrets. Roughly 30–40 minutes.

Nothing here affects the live site until the final step, so it is safe to work
through in test mode first.

---

## 1. Stripe — create the two plans

Use **test mode** first (the toggle at the top right of the Stripe dashboard).
Test mode has its own keys and its own products; nothing you do there can charge
a real card.

1. Products → **Add product**
   - Name `SmartCapStack Pro`, price **$10.00**, *Recurring, monthly*.
   - Save, then copy the **price ID** — it starts `price_`, not `prod_`.
2. Repeat for `SmartCapStack Broker` at **$50.00** monthly. Copy that price ID too.

Keep both IDs to hand.

## 2. Stripe — get your secret key

Developers → API keys → **Secret key**. Starts `sk_test_` in test mode.

This key can charge cards and read your customers. It goes into Supabase in the
next step and must never be pasted into the app, this repo, or a browser.

## 3. Install the Supabase CLI and deploy the functions

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref kleclpgdnciskeigamrr
supabase functions deploy create-checkout-session
supabase functions deploy billing-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` on the webhook is deliberate and only for that one:
Stripe does not carry a Supabase login, so the function authenticates the
request by checking Stripe's signature instead. The other two require a signed-in
user and must keep the default.

## 4. Give Supabase the secrets

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_PRICE_PRO=price_xxx \
  STRIPE_PRICE_PLUS=price_yyy \
  SITE_URL=https://smartcapstack.com
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided
to functions automatically — you do not set those.

## 5. Point Stripe at the webhook

Stripe → Developers → Webhooks → **Add endpoint**.

- URL: `https://kleclpgdnciskeigamrr.supabase.co/functions/v1/stripe-webhook`
- Events to send — exactly these four:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the **signing secret** (starts `whsec_`) and add it:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## 6. Make your own account permanent

Supabase dashboard → Authentication → Users → your row → copy the **UID**.

Paste it into `OWNER_IDS` in `src/lib/plan.js`:

```js
const OWNER_IDS=[
  '00000000-0000-0000-0000-000000000000',   // ← yours
];
```

That gives your account the top tier for good, independent of billing, so
running the product never means paying yourself.

## 7. Test it end to end

With test keys still in place, on the live site or a local build:

1. Sign in, go to **/pricing**, choose Pro.
2. Pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. You should land back on `/account` and the plan should flip to Pro within a
   few seconds — the app polls while the webhook lands.
4. Check exports unlock, and that the deal cap is gone.
5. Account → **Manage billing** → cancel. The plan should return to Free.

If the plan does not change, look at the webhook: Stripe → Webhooks → your
endpoint → recent deliveries shows the response. `supabase functions logs
stripe-webhook` shows the other side.

## 8. Go live

Flip Stripe to live mode, create the two products again there (live mode has
separate products), and re-run step 4 and step 5 with the live keys, live price
IDs, and the live webhook's signing secret.

---

## What is deliberately not built

**Server-side enforcement.** The engine ships to the browser, so the gates are
bypassable by anyone willing to read the bundle. This is an accepted trade at
this scale — the audience is people buying buildings, not people de-minifying
JavaScript. If it ever matters, the fix is generating the workbook in an Edge
Function rather than in the page.

**Annual billing.** Monthly only for now. Adding a yearly price later is a new
Price in Stripe and one more entry in the `PRICES` map in
`create-checkout-session`.

**Proration and plan switching inside the app.** The Stripe billing portal
handles both, which is why "Manage billing" points there instead.
