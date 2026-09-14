import Link from "next/link";

import { Button } from "@/components/ui/button";
import { asRoute } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md text-center">
        <CardHeader>
          <p className="text-6xl font-bold text-foreground">404</p>
          <CardTitle className="mt-4 text-xl">Page not found</CardTitle>
          <CardDescription>The page you're looking for doesn't exist or has been moved.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={asRoute("/chat")}>Chat</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
