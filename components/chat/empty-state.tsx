import { MessageCircle } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-chat-bg p-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
        <MessageCircle className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">ChatFlow</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Select a conversation from the sidebar or add a friend to start chatting.
      </p>
    </div>
  )
}
