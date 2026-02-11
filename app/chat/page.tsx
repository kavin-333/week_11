import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChatShell } from "@/components/chat/chat-shell"

export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <ChatShell
      currentUser={{
        id: user.id,
        display_name: profile?.display_name || user.user_metadata?.display_name || "User",
        email: user.email || "",
        avatar_url: profile?.avatar_url || null,
        created_at: profile?.created_at || "",
      }}
    />
  )
}
