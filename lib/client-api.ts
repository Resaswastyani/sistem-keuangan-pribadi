"use client"

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    credentials: "same-origin",
    cache: "no-store",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    window.location.href = "/login"
    throw new ApiError(401, "Sesi berakhir")
  }
  if (!res.ok) {
    const issue = Array.isArray(data?.issues) && data.issues[0] ? ` (${data.issues[0].path}: ${data.issues[0].message})` : ""
    throw new ApiError(res.status, (data?.error ?? "Terjadi kesalahan.") + issue)
  }
  return data as T
}

export type DashboardData = {
  user: { id: string; username: string; displayName: string; monthlyBudget: number }
  today: string
  day: string
  timezone: string
  stats: { balance: number; balanceChangePct: number | null; monthIncome: number; monthIncomeCount: number; monthExpense: number; monthExpenseCount: number; monthlyBudget: number }
  categories: { category: string; total: number }[]
  chart: { day: string; income: number; expense: number }[]
  transactions: { id: string; name: string; category: string; amount: number; goalId: string | null; occurredAt: string }[]
  goals: { id: string; title: string; note: string; targetAmount: number; savedAmount: number; deadline: string | null; color: string; icon: string }[]
  schedule: { id: string; day: string; startTime: string; endTime: string; title: string; detail: string; icon: string; color: string; done: boolean; remindBeforeMin: number | null; routineId: string | null }[]
  reminders: { id: string; title: string; detail: string; icon: string; color: string; remindAt: string; repeat: "none" | "daily" | "weekly" | "monthly"; done: boolean }[]
  notifications: { id: string; kind: string; title: string; body: string; url: string; readAt: string | null; createdAt: string }[]
  unreadCount: number
}
