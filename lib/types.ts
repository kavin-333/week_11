export interface Profile {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
  created_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted" | "rejected"
  created_at: string
  requester?: Profile
  addressee?: Profile
}

export interface Message {
  id: string
  friendship_id: string
  sender_id: string
  content: string
  created_at: string
  is_read: boolean
  attachment_url?: string | null
  attachment_type?: string | null
}

export interface ConversationItem {
  friendship_id: string
  friend: Profile
  last_message: string | null
  last_message_time: string | null
  unread_count: number
}
