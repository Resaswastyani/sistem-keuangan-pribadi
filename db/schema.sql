-- mellow — skema database (PostgreSQL / Neon)
-- Aman dijalankan berulang kali (idempotent).

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists users (
  id               uuid primary key default gen_random_uuid(),
  username         citext not null unique,
  display_name     text not null,
  password_hash    text not null,
  monthly_budget   bigint not null default 1200000 check (monthly_budget >= 0),
  failed_attempts  int not null default 0,
  locked_until     timestamptz,
  token_version    int not null default 0,
  daily_digest_on  date,
  budget_alert_on  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists login_attempts (
  id           bigserial primary key,
  ip           text not null,
  username     text,
  success      boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_ip_idx on login_attempts (ip, attempted_at desc);

create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 80),
  note          text not null default '',
  target_amount bigint not null check (target_amount > 0),
  saved_amount  bigint not null default 0 check (saved_amount >= 0),
  deadline      date,
  color         text not null default 'goal-pink',
  icon          text not null default 'sparkles',
  created_at    timestamptz not null default now()
);
create index if not exists goals_user_idx on goals (user_id, created_at);

create table if not exists transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  goal_id     uuid references goals(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 80),
  category    text not null default 'Lainnya',
  amount      bigint not null check (amount <> 0),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists transactions_user_idx on transactions (user_id, occurred_at desc);

create table if not exists schedule_items (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references users(id) on delete cascade,
  day                date not null,
  start_time         time not null,
  end_time           time not null,
  title              text not null check (char_length(title) between 1 and 80),
  detail             text not null default '',
  icon               text not null default 'sparkles',
  color              text not null default 'pink',
  done               boolean not null default false,
  remind_before_min  int check (remind_before_min between 0 and 1440),
  reminded_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists schedule_user_day_idx on schedule_items (user_id, day, start_time);

create table if not exists reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 80),
  detail       text not null default '',
  icon         text not null default 'bell',
  color        text not null default 'pink',
  remind_at    timestamptz not null,
  repeat       text not null default 'none' check (repeat in ('none','daily','weekly','monthly')),
  done         boolean not null default false,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists reminders_due_idx on reminders (remind_at) where done = false;

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null,
  body       text not null default '',
  url        text not null default '/',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text not null default '',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_user_idx on push_subscriptions (user_id);
