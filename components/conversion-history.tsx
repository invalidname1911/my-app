"use client"

import React from "react"
import { Download, Play, Clock, FileAudio, Trash2 } from "lucide-react"
import { Button } from "./ui/button"

const mockHistory = [
  {
    id: 1,
    title: "Amazing Song - Artist Name",
    duration: "3:45",
    quality: "320 kbps",
    size: "8.7 MB",
    convertedAt: "2 minutes ago",
    thumbnail: "/abstract-music-waves.png",
  },
  {
    id: 2,
    title: "Another Great Track - Different Artist",
    duration: "4:12",
    quality: "320 kbps",
    size: "9.8 MB",
    convertedAt: "1 hour ago",
    thumbnail: "/abstract-soundscape.png",
  },
  {
    id: 3,
    title: "Podcast Episode #123 - Tech Talk",
    duration: "45:30",
    quality: "192 kbps",
    size: "62.4 MB",
    convertedAt: "3 hours ago",
    thumbnail: "/podcast-microphone.png",
  },
]

export function ConversionHistory() {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium">Recent Conversions</h3>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>

      <div className="space-y-4">
        {mockHistory.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 p-4 bg-accent/30 rounded-lg border border-border/60"
          >
            <img
              src={item.thumbnail || "/placeholder.svg"}
              alt={item.title}
              className="w-12 h-12 rounded-lg object-cover bg-zinc-700"
            />

            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{item.title}</h4>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {item.duration}
                </span>
                <span className="flex items-center gap-1">
                  <FileAudio className="w-3 h-3" />
                  {item.quality}
                </span>
                <span>{item.size}</span>
                <span>{item.convertedAt}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Play className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {mockHistory.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No conversions yet</p>
          <p className="text-sm mt-1">Your converted files will appear here</p>
        </div>
      )}
    </div>
  )
}
