"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, ConversationItem, Friendship } from "@/lib/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search,
  UserPlus,
  LogOut,
  MessageCircle,
  Users,
  Check,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { AddFriendDialog } from "./add-friend-dialog"
import { formatDistanceToNow } from "date-fns"

interface SidebarProps {
  currentUser: Profile
  activeConversationId: string | null
  onSelectConversation: (conversation: ConversationItem) => void
}

type SidebarTab = "chats" | "requests"

export function Sidebar({ currentUser, activeConversationId, onSelectConversation }: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("chats")
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchConversations = useCallback(async () => {
    // Get accepted friendships
    const { data: friendships } = await supabase
      .from("friendships")
      .select(`
        id,
        requester_id,
        addressee_id,
        status,
        created_at
      `)
      .eq("status", "accepted")
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)

    if (!friendships || friendships.length === 0) {
      setConversations([])
      setIsLoading(false)
      return
    }

    const convItems: ConversationItem[] = []

    for (const f of friendships) {
      const friendId = f.requester_id === currentUser.id ? f.addressee_id : f.requester_id

      // Get friend profile
      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", friendId)
        .single()

      if (!friendProfile) continue

      // Get last message
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("*")
        .eq("friendship_id", f.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      // Get unread count
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("friendship_id", f.id)
        .eq("is_read", false)
        .neq("sender_id", currentUser.id)

      convItems.push({
        friendship_id: f.id,
        friend: friendProfile,
        last_message: lastMsg?.content || null,
        last_message_time: lastMsg?.created_at || f.created_at,
        unread_count: count || 0,
      })
    }

    // Sort by last message time
    convItems.sort((a, b) => {
      const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0
      const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0
      return timeB - timeA
    })

    setConversations(convItems)
    setIsLoading(false)
  }, [currentUser.id, supabase])

  const fetchPendingRequests = useCallback(async () => {
    // Requests sent TO current user
    const { data: incoming } = await supabase
      .from("friendships")
      .select("*")
      .eq("addressee_id", currentUser.id)
      .eq("status", "pending")

    if (!incoming) {
      setPendingRequests([])
      return
    }

    // Fetch requester profiles
    const requestsWithProfiles: Friendship[] = []
    for (const req of incoming) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", req.requester_id)
        .single()

      requestsWithProfiles.push({
        ...req,
        requester: profile || undefined,
      })
    }

    setPendingRequests(requestsWithProfiles)
  }, [currentUser.id, supabase])

  useEffect(() => {
    fetchConversations()
    fetchPendingRequests()
  }, [fetchConversations, fetchPendingRequests])

  // Subscribe to realtime changes for new messages
  useEffect(() => {
    const channel = supabase
      .channel("sidebar-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          fetchConversations()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          fetchConversations()
          fetchPendingRequests()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchConversations, fetchPendingRequests])

  const handleAcceptRequest = async (friendshipId: string) => {
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId)

    fetchPendingRequests()
    fetchConversations()
  }

  const handleRejectRequest = async (friendshipId: string) => {
    await supabase
      .from("friendships")
      .update({ status: "rejected" })
      .eq("id", friendshipId)

    fetchPendingRequests()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ""
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: false })
    } catch {
      return ""
    }
  }

  const filteredConversations = conversations.filter((c) =>
    c.friend.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {getInitials(currentUser.display_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-card-foreground">{currentUser.display_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-card-foreground" onClick={() => setShowAddFriend(true)}>
            <UserPlus className="h-5 w-5" />
            <span className="sr-only">Add friend</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-card-foreground">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("chats")}
          className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === "chats"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          Chats
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`relative flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          <Users className="h-4 w-4" />
          Requests
          {pendingRequests.length > 0 && (
            <span className="absolute right-1/4 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {tab === "chats" && (
        <>
          {/* Search */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9 bg-secondary border-0 text-card-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  {conversations.length === 0
                    ? "No conversations yet. Add a friend to start chatting!"
                    : "No conversations match your search."}
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.friendship_id}
                    onClick={() => onSelectConversation(conv)}
                    className={`flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                      activeConversationId === conv.friendship_id ? "bg-secondary" : ""
                    }`}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className="bg-emerald-600 text-card text-sm">
                        {getInitials(conv.friend.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-card-foreground truncate">
                          {conv.friend.display_name}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatTime(conv.last_message_time)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground truncate">
                          {conv.last_message || "Start a conversation"}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="ml-2 flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {tab === "requests" && (
        <ScrollArea className="flex-1">
          {pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                No pending friend requests.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-sky-600 text-card text-sm">
                      {getInitials(req.requester?.display_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <span className="text-sm font-semibold text-card-foreground truncate">
                      {req.requester?.display_name || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {req.requester?.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-primary hover:bg-primary/10"
                      onClick={() => handleAcceptRequest(req.id)}
                    >
                      <Check className="h-5 w-5" />
                      <span className="sr-only">Accept</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRejectRequest(req.id)}
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">Reject</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      <AddFriendDialog
        open={showAddFriend}
        onOpenChange={setShowAddFriend}
        currentUser={currentUser}
        onRequestSent={fetchPendingRequests}
      />
    </div>
  )
}
