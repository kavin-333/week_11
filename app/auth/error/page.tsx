import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

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
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl text-card-foreground">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              {params?.error ? (
                <p className="text-sm text-muted-foreground">
                  Error: {params.error}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An unspecified error occurred.
                </p>
              )}
              <Link href="/auth/login" className="mt-4 inline-block text-sm text-primary font-medium hover:underline">
                Back to sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
