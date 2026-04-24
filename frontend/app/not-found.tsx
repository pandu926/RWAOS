import { Button, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <EmptyState
          title="Page not found"
          description="The route you requested is not available in this Confidential RWA OS demo. Use primary navigation to return to the product flow."
          action={<Button href="/dashboard">Back to dashboard</Button>}
        />
      </div>
    </main>
  );
}
