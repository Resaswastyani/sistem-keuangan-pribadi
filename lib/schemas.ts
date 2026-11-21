import { z } from "zod"
import { colorKey, iconKey, optionalText, rupiah, shortText } from "./api"

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD")
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam HH:MM")

export const goalSchema = z.object({
  title: shortText(),
  note: optionalText(),
  targetAmount: rupiah,
  deadline: date.nullable().optional(),
  color: z.enum(["goal-pink", "goal-lilac", "goal-peach"]).default("goal-pink"),
  icon: iconKey.default("sparkles"),
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

export const reminderSchema = z.object({
  title: shortText(),
  detail: optionalText(),
  date,
  time,
  repeat: z.enum(["none", "daily", "weekly", "monthly"]).default("none"),
  icon: iconKey.default("bell"),
  color: colorKey.default("pink"),
})

// Skema PATCH ditulis tanpa .default() agar field yang tidak dikirim tidak ter-reset.
export const goalPatchSchema = z.object({
  title: shortText().optional(),
  note: z.string().trim().max(160).optional(),
  targetAmount: rupiah.optional(),
  deadline: date.nullable().optional(),
  color: z.enum(["goal-pink", "goal-lilac", "goal-peach"]).optional(),
  icon: iconKey.optional(),
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
