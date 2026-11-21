import { z } from "zod"
import { json, withUser } from "@/lib/api"
import { APP_TZ, sql } from "@/lib/db"

const dayParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()

/** Satu endpoint untuk semua data dashboard, supaya UI cukup sekali fetch. */
export const GET = withUser(async (req, { user }) => {
  const url = new URL(req.url)
  const requestedDay = dayParam.parse(url.searchParams.get("day") ?? undefined)

  const [{ today }] = await sql`select to_char(now() at time zone ${APP_TZ}, 'YYYY-MM-DD') as today`
  const day = requestedDay ?? today

  const [stats, categories, chart, transactions, goals, schedule, reminders, notifications, unread] = await Promise.all([
    sql`
      with b as (
        select
          coalesce(sum(amount), 0)::bigint as balance,
          coalesce(sum(amount) filter (where (occurred_at at time zone ${APP_TZ}) < date_trunc('month', now() at time zone ${APP_TZ})), 0)::bigint as balance_month_start,
          coalesce(sum(amount) filter (where amount > 0 and (occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ})), 0)::bigint as month_income,
          count(*) filter (where amount > 0 and (occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ}))::int as month_income_count,
          coalesce(-sum(amount) filter (where amount < 0 and goal_id is null and (occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ})), 0)::bigint as month_expense,
          count(*) filter (where amount < 0 and goal_id is null and (occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ}))::int as month_expense_count
        from transactions where user_id = ${user.id}
      ) select * from b`,
    sql`
      select category, (-sum(amount))::bigint as total
      from transactions
      where user_id = ${user.id} and amount < 0 and goal_id is null
        and (occurred_at at time zone ${APP_TZ}) >= date_trunc('month', now() at time zone ${APP_TZ})
      group by category order by total desc limit 6`,
    sql`
      with days as (
        select generate_series((now() at time zone ${APP_TZ})::date - 6, (now() at time zone ${APP_TZ})::date, interval '1 day')::date as d
      )
      select to_char(days.d, 'YYYY-MM-DD') as day,
        coalesce(sum(t.amount) filter (where t.amount > 0), 0)::bigint as income,
        coalesce(-sum(t.amount) filter (where t.amount < 0), 0)::bigint as expense
      from days
      left join transactions t on t.user_id = ${user.id} and (t.occurred_at at time zone ${APP_TZ})::date = days.d
      group by days.d order by days.d`,
    sql`
      select id, name, category, amount, goal_id, occurred_at
      from transactions where user_id = ${user.id}
      order by occurred_at desc, created_at desc limit 100`,
    sql`
      select id, title, note, target_amount, saved_amount, to_char(deadline, 'YYYY-MM-DD') as deadline, color, icon
      from goals where user_id = ${user.id} order by created_at`,
    sql`
      select id, to_char(day, 'YYYY-MM-DD') as day, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time,
        title, detail, icon, color, done, remind_before_min
      from schedule_items where user_id = ${user.id} and day = ${day}::date order by start_time`,
    sql`
      select id, title, detail, icon, color, remind_at, repeat, done
      from reminders where user_id = ${user.id} and (done = false or remind_at > now() - interval '1 day')
      order by done, remind_at limit 100`,
    sql`
      select id, kind, title, body, url, read_at, created_at
      from notifications where user_id = ${user.id} order by created_at desc limit 30`,
    sql`select count(*)::int as count from notifications where user_id = ${user.id} and read_at is null`,
  ])

  const s = stats[0]
  const num = (v: unknown) => Number(v ?? 0)
  const balance = num(s.balance)
  const start = num(s.balance_month_start)

  return json({
    user,
    today,
    day,
    timezone: APP_TZ,
    stats: {
      balance,
      balanceChangePct: start !== 0 ? ((balance - start) / Math.abs(start)) * 100 : null,
      monthIncome: num(s.month_income),
      monthIncomeCount: num(s.month_income_count),
      monthExpense: num(s.month_expense),
      monthExpenseCount: num(s.month_expense_count),
      monthlyBudget: user.monthlyBudget,
    },
    categories: categories.map((c) => ({ category: c.category, total: num(c.total) })),
    chart: chart.map((c) => ({ day: c.day, income: num(c.income), expense: num(c.expense) })),
    transactions: transactions.map((t) => ({ id: t.id, name: t.name, category: t.category, amount: num(t.amount), goalId: t.goal_id, occurredAt: t.occurred_at })),
    goals: goals.map((g) => ({ id: g.id, title: g.title, note: g.note, targetAmount: num(g.target_amount), savedAmount: num(g.saved_amount), deadline: g.deadline, color: g.color, icon: g.icon })),
    schedule: schedule.map((i) => ({ id: i.id, day: i.day, startTime: i.start_time, endTime: i.end_time, title: i.title, detail: i.detail, icon: i.icon, color: i.color, done: i.done, remindBeforeMin: i.remind_before_min })),
    reminders: reminders.map((r) => ({ id: r.id, title: r.title, detail: r.detail, icon: r.icon, color: r.color, remindAt: r.remind_at, repeat: r.repeat, done: r.done })),
    notifications: notifications.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, url: n.url, readAt: n.read_at, createdAt: n.created_at })),
    unreadCount: unread[0].count,
  })
})
