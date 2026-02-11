"use client"

import React from "react"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { UserPlus, Loader2 } from "lucide-react"

interface AddFriendDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUser: Profile
  onRequestSent: () => void
}

export function AddFriendDialog({ open, onOpenChange, currentUser, onRequestSent }: AddFriendDialogProps) {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    const supabase = createClient()
    const trimmedEmail = email.trim().toLowerCase()

    if (trimmedEmail === currentUser.email.toLowerCase()) {
      setMessage({ type: "error", text: "You cannot send a friend request to yourself." })
      setIsLoading(false)
      return
    }

    try {
      // Find user by email
      const { data: targetProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", trimmedEmail)
        .single()

      if (profileError || !targetProfile) {
        setMessage({ type: "error", text: "No user found with that email address." })
        setIsLoading(false)
        return
      }

      // Check if friendship already exists
      const { data: existing } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(requester_id.eq.${currentUser.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${currentUser.id})`
        )

      if (existing && existing.length > 0) {
        const status = existing[0].status
        if (status === "accepted") {
          setMessage({ type: "error", text: "You are already friends with this user." })
        } else if (status === "pending") {
          setMessage({ type: "error", text: "A friend request is already pending." })
        } else {
          // rejected - allow re-sending
          await supabase
            .from("friendships")
            .update({ status: "pending", requester_id: currentUser.id, addressee_id: targetProfile.id })
            .eq("id", existing[0].id)

          setMessage({ type: "success", text: `Friend request sent to ${targetProfile.display_name}!` })
          setEmail("")
          onRequestSent()
        }
        setIsLoading(false)
        return
      }

      // Create new friendship
      const { error: insertError } = await supabase
        .from("friendships")
        .insert({
          requester_id: currentUser.id,
          addressee_id: targetProfile.id,
          status: "pending",
        })

      if (insertError) {
        setMessage({ type: "error", text: "Failed to send friend request. Please try again." })
        setIsLoading(false)
        return
      }

      setMessage({ type: "success", text: `Friend request sent to ${targetProfile.display_name}!` })
      setEmail("")
      onRequestSent()
    } catch {
      setMessage({ type: "error", text: "Something went wrong. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEmail("")
      setMessage(null)
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-card-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            Add a Friend
          </DialogTitle>
          <DialogDescription>
            {"Enter your friend's email address to send them a request."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSendRequest} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="friend-email">Email Address</Label>
            <Input
              id="friend-email"
              type="email"
              placeholder="friend@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-primary" : "text-destructive"}`}>
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Friend Request"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
