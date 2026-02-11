import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Mail } from "lucide-react"
import Link from "next/link"

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <MessageCircle className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">ChatFlow</h1>
          </div>
          <Card className="w-full">
            <CardHeader className="items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl text-card-foreground">Check your email</CardTitle>
              <CardDescription className="text-center">
                {"We've sent you a confirmation link. Please check your email to verify your account."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                After confirming your email, you can{" "}
                <Link href="/auth/login" className="text-primary font-medium hover:underline">
                  sign in
                </Link>{" "}
                and start chatting.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
