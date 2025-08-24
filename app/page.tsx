import { Sidebar } from "@/components/sidebar"
import { MainContent } from "@/components/main-content"

export default function Home() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <MainContent />
    </div>
  )
}
