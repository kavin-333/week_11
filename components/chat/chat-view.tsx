"use client"

import React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, ConversationItem, Message } from "@/lib/types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Send, Paperclip, FileIcon, X, Loader2 } from "lucide-react"
import { format, isToday, isYesterday } from "date-fns"

interface ChatViewProps {
  currentUser: Profile
  conversation: ConversationItem
  onBack: () => void
}

export function ChatView({ currentUser, conversation, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [attachment, setAttachment] = useState<{ file: File; preview: string; type: 'image' | 'file' } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("friendship_id", conversation.friendship_id)
      .order("created_at", { ascending: true })

    if (data) {
      setMessages(data)
    }
    setIsLoading(false)
  }, [conversation.friendship_id, supabase])

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("friendship_id", conversation.friendship_id)
      .eq("is_read", false)
      .neq("sender_id", currentUser.id)
  }, [conversation.friendship_id, currentUser.id, supabase])

  useEffect(() => {
    fetchMessages()
    markAsRead()
  }, [fetchMessages, markAsRead])

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversation.friendship_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `friendship_id=eq.${conversation.friendship_id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // Mark as read if from friend
          if (newMsg.sender_id !== currentUser.id) {
            markAsRead()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversation.friendship_id, currentUser.id, supabase, markAsRead])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Determine type
      const type = file.type.startsWith('image/') ? 'image' : 'file'

      // Create preview
      let preview = ''
      if (type === 'image') {
        preview = URL.createObjectURL(file)
      }

      setAttachment({ file, preview, type })
    }
  }

  const removeAttachment = () => {
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview)
    }
    setAttachment(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `${conversation.friendship_id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file)

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleSend = async () => {
    const trimmed = newMessage.trim()
    if ((!trimmed && !attachment) || isSending || isUploading) return

    setIsSending(true)

    let attachmentUrl = null
    let attachmentType = null

    try {
      if (attachment) {
        setIsUploading(true)
        attachmentUrl = await uploadFile(attachment.file)
        attachmentType = attachment.type
        setIsUploading(false)
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      setIsSending(false)
      setIsUploading(false)
      return
    }

    setNewMessage("")
    const currentAttachment = attachment
    setAttachment(null)

    // Optimistically add message to local state immediately
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      friendship_id: conversation.friendship_id,
      sender_id: currentUser.id,
      content: trimmed,
      is_read: false,
      created_at: new Date().toISOString(),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    }
    setMessages((prev) => [...prev, optimisticMsg])

    const { data, error } = await supabase
      .from("messages")
      .insert({
        friendship_id: conversation.friendship_id,
        sender_id: currentUser.id,
        content: trimmed,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
      })
      .select()
      .single()

    if (error) {
      // Remove optimistic message on failure and restore input
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setNewMessage(trimmed)
      if (currentAttachment) setAttachment(currentAttachment)
    } else if (data) {
      // Replace optimistic message with real one from DB
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? data : m))
      )
    }

    setIsSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const formatMessageTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "h:mm a")
    } catch {
      return ""
    }
  }

  const formatDateHeader = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      if (isToday(date)) return "Today"
      if (isYesterday(date)) return "Yesterday"
      return format(date, "MMMM d, yyyy")
    } catch {
      return ""
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd")
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.messages.push(msg)
    } else {
      groupedMessages.push({ date: dateKey, messages: [msg] })
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-chat-bg">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden text-muted-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-emerald-600 text-card text-sm">
            {getInitials(conversation.friend.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold text-card-foreground">
            {conversation.friend.display_name}
          </span>
          <span className="text-xs text-muted-foreground">
            {conversation.friend.email}
          </span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground text-center rounded-lg bg-card/80 px-4 py-2">
              {"No messages yet. Say hello!"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date header */}
                <div className="flex items-center justify-center py-2">
                  <span className="rounded-lg bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
                    {formatDateHeader(group.messages[0].created_at)}
                  </span>
                </div>
                {/* Messages */}
                {group.messages.map((msg) => {
                  const isOutgoing = msg.sender_id === currentUser.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex mb-1 ${isOutgoing ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm ${isOutgoing
                            ? "bg-chat-outgoing rounded-br-md"
                            : "bg-chat-incoming rounded-bl-md"
                          }`}
                      >
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        {msg.attachment_url && (
                          <div className={`mt-2 ${!msg.content ? '-mt-1' : ''}`}>
                            {msg.attachment_type === 'image' ? (
                              <div className="relative overflow-hidden rounded-lg">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.attachment_url}
                                  alt="Attachment"
                                  className="max-w-[200px] max-h-[200px] object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 rounded-lg p-2 text-sm transition-colors ${isOutgoing ? 'bg-black/10 hover:bg-black/20' : 'bg-black/5 hover:bg-black/10'
                                  }`}
                              >
                                <FileIcon className="h-4 w-4" />
                                <span className="underline decoration-1 underline-offset-4">View File</span>
                              </a>
                            )}
                          </div>
                        )}
                        <div className={`flex items-center gap-1 mt-0.5 ${isOutgoing ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-muted-foreground">
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {isOutgoing && (
                            <svg
                              className={`h-3.5 w-3.5 ${msg.is_read ? "text-sky-500" : "text-muted-foreground"}`}
                              viewBox="0 0 16 16"
                              fill="currentColor"
                            >
                              <path d="M4.5 8.5L7 11L11.5 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M7.5 8.5L10 11L14.5 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border bg-card px-3 py-2.5">
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-secondary p-2">
            {attachment.type === 'image' ? (
              <div className="relative h-12 w-12 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.preview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                <FileIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 truncate text-xs text-muted-foreground">
              {attachment.file.name}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={removeAttachment}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          // accept="image/*,.pdf,.doc,.docx" // Optional: restrict file types
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-[42px] w-[42px] rounded-full flex-shrink-0 text-muted-foreground hover:bg-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || isUploading}
          >
            <Paperclip className="h-5 w-5" />
            <span className="sr-only">Attach file</span>
          </Button>
          <textarea
            ref={inputRef}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-2xl border border-input bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[42px] max-h-[120px]"
            rows={1}
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value)
              // Auto resize
              e.target.style.height = "auto"
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
            }}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            className="h-[42px] w-[42px] rounded-full flex-shrink-0"
            onClick={handleSend}
            disabled={(!newMessage.trim() && !attachment) || isSending || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
