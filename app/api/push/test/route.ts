import { json, withUser } from "@/lib/api"
import { notifyUser } from "@/lib/notify"

export const POST = withUser(async (_req, { user }) => {
  const { sent } = await notifyUser(user.id, {
    kind: "test",
    title: "Halo dari mellow ✳",
    body: `Notifikasi sudah aktif, ${user.displayName}. Pengingatmu akan muncul seperti ini.`,
    url: "/?tab=Pengingat",
  })
  return json({ sent })
})
