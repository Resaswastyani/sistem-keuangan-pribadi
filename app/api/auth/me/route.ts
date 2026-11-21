import { json, withUser } from "@/lib/api"

export const GET = withUser(async (_req, { user }) => json({ user }))
