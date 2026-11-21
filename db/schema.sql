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

-- ===== Ibadah: jadwal sholat, puasa, dan pesan notifikasi custom =====
alter table users add column if not exists city_id text not null default '1405';
alter table users add column if not exists city_name text not null default 'KAB. BOYOLALI';
alter table users add column if not exists hijri_offset int not null default 0 check (hijri_offset between -2 and 2);

-- Cache jadwal sholat per kota per hari (diambil sebulan sekali dari API).
create table if not exists prayer_times (
  city_id  text not null,
  day      date not null,
  imsak    time not null,
  subuh    time not null,
  terbit   time not null,
  dhuha    time not null,
  dzuhur   time not null,
  ashar    time not null,
  maghrib  time not null,
  isya     time not null,
  source   text not null default 'myquran',
  fetched_at timestamptz not null default now(),
  primary key (city_id, day)
);

-- Preferensi tiap jenis notifikasi otomatis (sholat, puasa, ringkasan, anggaran, agenda).
-- title/body null = pakai pesan bawaan. Mendukung placeholder seperti {nama}, {sholat}, {waktu}.
create table if not exists notification_prefs (
  user_id    uuid not null references users(id) on delete cascade,
  key        text not null,
  enabled    boolean not null,
  before_min int not null default 0 check (before_min between 0 and 180),
  at_time    time,
  title      text check (char_length(title) <= 120),
  body       text check (char_length(body) <= 300),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- Penanda notifikasi terjadwal yang sudah terkirim (mencegah dobel).
create table if not exists notification_log (
  user_id uuid not null references users(id) on delete cascade,
  key     text not null,
  day     date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key, day)
);

-- Catatan puasa harian.
create table if not exists fasting_log (
  user_id    uuid not null references users(id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('ramadan','sunnah','qadha','nazar')),
  status     text not null check (status in ('planned','done','missed')),
  note       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ===== Rutinitas mingguan (otomatis menjadi agenda harian) =====
create table if not exists routines (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  weekday           smallint not null check (weekday between 0 and 6), -- 0 = Minggu
  start_time        time not null,
  end_time          time not null check (end_time > start_time),
  title             text not null check (char_length(title) between 1 and 80),
  detail            text not null default '',
  icon              text not null default 'sparkles',
  color             text not null default 'pink',
  remind_before_min int check (remind_before_min between 0 and 1440),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists routines_user_idx on routines (user_id, weekday, start_time);
alter table schedule_items add column if not exists routine_id uuid references routines(id) on delete cascade;
alter table schedule_items add column if not exists hidden boolean not null default false;
create unique index if not exists schedule_routine_day_uq on schedule_items (routine_id, day);

-- Pesan & on/off notifikasi per rutinitas
alter table routines add column if not exists remind_enabled boolean not null default true;
alter table routines add column if not exists notify_title text check (char_length(notify_title) <= 120);
alter table routines add column if not exists notify_body text check (char_length(notify_body) <= 300);

-- ===== Target pencapaian, tema animasi kartu =====
alter table goals add column if not exists kind text not null default 'money' check (kind in ('money','achievement'));
alter table goals add column if not exists progress_mode text not null default 'percent' check (progress_mode in ('percent','checklist'));
alter table goals add column if not exists progress int not null default 0 check (progress between 0 and 100);
alter table goals add column if not exists milestones jsonb not null default '[]'::jsonb;
alter table goals add column if not exists achieved_at timestamptz;
alter table goals add column if not exists theme text;
alter table goals alter column target_amount drop not null;
alter table goals drop constraint if exists goals_target_amount_check;
alter table goals drop constraint if exists goals_target_amount_chk;
alter table goals add constraint goals_target_amount_chk check (target_amount is null or target_amount > 0);
alter table users add column if not exists card_themes jsonb not null default '{}'::jsonb;
