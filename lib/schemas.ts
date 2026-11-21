import { z } from "zod"
import { CARD_THEME_KEYS } from "./card-themes"
import { colorKey, iconKey, optionalText, rupiah, shortText } from "./api"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD")
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam HH:MM")
const goalColor = z.enum(["goal-pink", "goal-lilac", "goal-peach"])
const theme = z.enum(CARD_THEME_KEYS).nullable()

export const milestonesSchema = z
  .array(z.object({ id: z.string().min(1).max(40), text: z.string().trim().min(1).max(120), done: z.boolean() }))
  .max(30)

/** Target: "money" (tabungan nominal) atau "achievement" (pencapaian, mis. beasiswa LPDP). */
export const goalSchema = z
  .object({
    kind: z.enum(["money", "achievement"]).default("money"),
    title: shortText(),
    note: optionalText(),
    targetAmount: rupiah.nullable().optional(),
    progressMode: z.enum(["percent", "checklist"]).default("percent"),
    progress: z.number().int().min(0).max(100).default(0),
    milestones: milestonesSchema.default([]),
    deadline: date.nullable().optional(),
    color: goalColor.default("goal-pink"),
    icon: iconKey.default("sparkles"),
    theme: theme.optional(),
  })
  .refine((g) => g.kind !== "money" || (g.targetAmount ?? 0) > 0, { message: "Jumlah target wajib diisi untuk target uang", path: ["targetAmount"] })

// Skema PATCH ditulis tanpa .default() agar field yang tidak dikirim tidak ter-reset.
export const goalPatchSchema = z.object({
  kind: z.enum(["money", "achievement"]).optional(),
  title: shortText().optional(),
  note: z.string().trim().max(160).optional(),
  targetAmount: rupiah.nullable().optional(),
  progressMode: z.enum(["percent", "checklist"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  milestones: milestonesSchema.optional(),
  achieved: z.boolean().optional(),
  deadline: date.nullable().optional(),
  color: goalColor.optional(),
  icon: iconKey.optional(),
  theme: theme.optional(),
})

export const scheduleSchema = z.object({
  day: date,
  startTime: time,
  endTime: time,
  title: shortText(),
  detail: optionalText(),
  icon: iconKey.default("sparkles"),
  color: colorKey.default("pink"),
  remindBeforeMin: z.coerce.number().int().min(0).max(1440).nullable().optional(),
})

export const schedulePatchSchema = z.object({
  day: date.optional(),
  startTime: time.optional(),
  endTime: time.optional(),
  title: shortText().optional(),
  detail: z.string().trim().max(160).optional(),
  icon: iconKey.optional(),
  color: colorKey.optional(),
  done: z.boolean().optional(),
  remindBeforeMin: z.coerce.number().int().min(0).max(1440).nullable().optional(),
})

export const reminderSchema = z.object({
  title: shortText(),
  detail: optionalText(),
  date,
  time,
  repeat: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  icon: iconKey.default("bell"),
  color: colorKey.default("pink"),
})

export const reminderPatchSchema = z.object({
  title: shortText().optional(),
  detail: z.string().trim().max(160).optional(),
  date: date.optional(),
  time: time.optional(),
  repeat: z.enum(["none", "daily", "weekly", "monthly"]).optional(),
  icon: iconKey.optional(),
  color: colorKey.optional(),
  done: z.boolean().optional(),
})

export const transactionPatchSchema = z.object({
  name: shortText().optional(),
  amount: rupiah.optional(),
  kind: z.enum(["expense", "income"]).optional(),
  category: z.string().trim().min(1).max(40).optional(),
  date: date.optional(),
  time: time.optional(),
})

export const routinePatchSchema = z.object({
  startTime: time.optional(),
  endTime: time.optional(),
  title: shortText().optional(),
  detail: z.string().trim().max(160).optional(),
  icon: iconKey.optional(),
  color: colorKey.optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  remindBeforeMin: z.number().int().min(0).max(1440).nullable().optional(),
})
