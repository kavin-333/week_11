"use client"

import { useState } from "react"
import type { Profile, ConversationItem } from "@/lib/types"
import { Sidebar } from "./sidebar"
import { ChatView } from "./chat-view"
import { EmptyState } from "./empty-state"

interface ChatShellProps {
  currentUser: Profile
}

export function ChatShell({ currentUser }: ChatShellProps) {
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null)
  const [showMobileChat, setShowMobileChat] = useState(false)

  const handleSelectConversation = (conversation: ConversationItem) => {
    setActiveConversation(conversation)
    setShowMobileChat(true)
  }

  const handleBack = () => {
    setShowMobileChat(false)
  }

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      {/* Sidebar - hidden on mobile when chat is open */}
      <div
        className={`w-full flex-shrink-0 border-r border-border md:w-[380px] lg:w-[420px] ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}
      >
        <Sidebar
          currentUser={currentUser}
          activeConversationId={activeConversation?.friendship_id ?? null}
          onSelectConversation={handleSelectConversation}
        />
      </div>

      {/* Chat view - full width on mobile */}
      <div
        className={`flex-1 ${
          showMobileChat ? "flex" : "hidden md:flex"
        }`}
      >
        {activeConversation ? (
          <ChatView
            currentUser={currentUser}
            conversation={activeConversation}
            onBack={handleBack}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
