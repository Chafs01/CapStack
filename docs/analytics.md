# How many users does SmartCapStack have?

## Before anything: does the table exist?

Telemetry swallows every error on purpose — it must never break the app or slow
it down. The cost of that is a silent failure mode: if the `events` table is
missing, inserts fail quietly and you see zero rows, which looks identical to
having no visitors.

Check first:

```sql
select count(*) as events_recorded, max(created_at) as most_recent from events;
```

If that errors with *relation "events" does not exist*, run this once:

```sql
create table if not exists public.events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  type       text not null,
  path       text,
  referrer   text,
  message    text,
  meta       jsonb,
  ua         text
);

alter table public.events enable row level security;

-- The browser may write events and nothing else. There is deliberately no
-- select policy, so the client cannot read anyone's data back out; you read it
-- here in the dashboard, which bypasses RLS.
drop policy if exists "client can insert events" on public.events;
create policy "client can insert events"
  on public.events for insert
  to anon, authenticated
  with check (true);
```

Then reload the site once and re-run the count — you should see a `pageview`.

---

Everything below runs in the Supabase **SQL Editor** on your own project. No
third-party analytics account, no dashboard to pay for.

Two different questions get confused as one:

- **How many people showed up?** — visitors and sessions.
- **How many people actually used it?** — someone who generated a pro forma.

The second is the one that tells you whether there is something worth charging
for. Traffic without completed analyses means the landing page is working and
the product isn't.

---

## The one number to watch

```sql
-- Engaged users per week: people who actually produced a pro forma.
select date_trunc('week', created_at)::date as week,
       count(distinct meta->>'vid') as people_who_ran_a_deal,
       count(*)                     as pro_formas_run
from events
where type = 'proforma_generated'
group by 1
order by 1 desc;
```

If `people_who_ran_a_deal` is growing week over week, you have a product.
If it is flat while pageviews grow, the problem is activation, not traffic.

---

## Visitors and sessions

```sql
-- Unique visitors and sessions per day (last 30 days).
select date_trunc('day', created_at)::date as day,
       count(distinct meta->>'vid') as visitors,
       count(distinct meta->>'sid') as sessions,
       count(*)                     as pageviews
from events
where type = 'pageview'
  and created_at > now() - interval '30 days'
group by 1
order by 1 desc;
```

`vid` is a random id kept in the visitor's own browser. It contains nothing
personal and is never shared. Someone using two browsers counts twice, and
someone clearing storage counts as new — every analytics tool has this limit,
including the paid ones.

---

## Signed-in accounts

Accounts are separate from visitors: today sign-in is optional, so most users
have no account at all.

```sql
-- Total accounts, and how many are recent.
select count(*)                                          as accounts,
       count(*) filter (where created_at > now() - interval '30 days') as new_last_30d,
       count(*) filter (where last_sign_in_at > now() - interval '30 days') as active_last_30d
from auth.users;
```

```sql
-- How many people save deals, and how many deals they keep.
select count(distinct user_id) as users_with_saved_deals,
       count(*)                as total_saved_deals,
       round(count(*)::numeric / nullif(count(distinct user_id), 0), 1) as deals_per_user
from deals;
```

---

## The funnel — where people fall out

```sql
-- Distinct people reaching each step, last 30 days.
select type as milestone,
       count(distinct meta->>'vid') as people
from events
where created_at > now() - interval '30 days'
  and type in ('pageview','demo_viewed','analysis_started',
               'proforma_generated','excel_exported','deal_saved','share_created')
group by 1
order by people desc;
```

What the milestones mean:

| Event | Fires when |
|---|---|
| `pageview` | any page load |
| `demo_viewed` | opened the sample deal — interested, zero effort |
| `analysis_started` | started their own analysis |
| `proforma_generated` | **entered a real deal and got results** |
| `excel_exported` | downloaded the workbook |
| `deal_saved` | saved a deal |
| `share_created` | copied a share link — the growth loop |

---

## Are people coming back?

Repeat use matters more than raw counts when deciding to charge: a tool people
return to is a tool people will pay for.

```sql
-- Of the people who ran a deal, how many did so on more than one day?
with runs as (
  select meta->>'vid' as vid, date_trunc('day', created_at)::date as day
  from events
  where type = 'proforma_generated'
  group by 1, 2
)
select count(*) filter (where days = 1) as one_day_only,
       count(*) filter (where days > 1) as came_back,
       round(100.0 * count(*) filter (where days > 1) / nullif(count(*), 0), 1) as pct_returning
from (select vid, count(*) as days from runs group by 1) t;
```

---

## Is anything broken for real people?

```sql
select date_trunc('day', created_at)::date as day,
       count(*)                     as errors,
       count(distinct meta->>'vid') as people_affected,
       min(message)                 as example
from events
where type = 'error'
  and created_at > now() - interval '14 days'
group by 1
order by 1 desc;
```

---

## Optional: speed this up once there is real volume

The ids live inside the `meta` JSON so no migration was needed to start
collecting. Below roughly a million rows this is fine. If counting gets slow:

```sql
create index if not exists events_vid_idx on events ((meta->>'vid'));
create index if not exists events_type_created_idx on events (type, created_at desc);
```

---

## A note on reading these

Early numbers are mostly you. Filter yourself out once you know your own `vid`
— open the site, run this in the browser console, and exclude it:

```js
localStorage.getItem('scs_vid')
```

```sql
-- ...then add to any query above:
and meta->>'vid' <> 'paste-your-vid-here'
```
