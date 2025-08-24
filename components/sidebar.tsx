"use client"
import { Home, Download, History, Settings, User, HelpCircle, LogOut, Music } from "lucide-react"

const navigationItems = [
  { icon: Home, label: "Dashboard", active: true },
  { icon: Download, label: "Converter" },
  { icon: History, label: "History" },
]

const settingsItems = [
  { icon: Settings, label: "Settings" },
  { icon: User, label: "Account" },
]

const communityItems = [{ icon: HelpCircle, label: "Support" }]

export function Sidebar() {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Music className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">YT2MP3</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <nav className="space-y-6">
          {/* Main Navigation */}
          <div>
            <div className="space-y-1">
              {navigationItems.map((item) => (
                <button
                  key={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    item.active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Settings</h3>
            <div className="space-y-1">
              {settingsItems.map((item) => (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Community</h3>
            <div className="space-y-1">
              {communityItems.map((item) => (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Sign Out */}
      <div className="p-4 border-t border-border">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </div>
    </div>
  )
}
