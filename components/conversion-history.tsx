"use client"

import React, { useState, useEffect } from "react"
import { Download, Clock, FileAudio, Trash2, ExternalLink, Copy, Search } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { useToast } from "@/hooks/use-toast"

interface ConversionItem {
  id: string
  title: string
  duration: string
  quality: string
  size?: string
  convertedAt: string
  thumbnail?: string
  url: string
  jobId: string
}

const STORAGE_KEY = 'youtube-conversions'
const HISTORY_UPDATED_EVENT = 'conversion-history-updated'

// Export function to add conversions from outside
export const addToConversionHistory = (conversion: Omit<ConversionItem, 'id' | 'convertedAt'>) => {
  if (typeof window === 'undefined') return

  console.log('Adding conversion to history:', conversion)
  const stored = localStorage.getItem(STORAGE_KEY)
  let history: ConversionItem[] = []

  if (stored) {
    try {
      history = JSON.parse(stored)
    } catch (error) {
      console.error('Error parsing conversion history:', error)
    }
  }

  const newConversion: ConversionItem = {
    ...conversion,
    id: Date.now().toString(),
    convertedAt: new Date().toLocaleString(),
  }

  history = [newConversion, ...history.slice(0, 9)] // Keep only last 10 items
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))

  // Trigger a custom event to update the UI
  window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT, { detail: { history } }))
}

export function ConversionHistory() {
  const [history, setHistory] = useState<ConversionItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  // Debug: log when history changes
  useEffect(() => {
    console.log('History state changed:', history)
  }, [history])

  // Load history from localStorage on component mount
  useEffect(() => {
    const loadHistory = () => {
      if (typeof window === 'undefined') return
      const stored = localStorage.getItem(STORAGE_KEY)
      console.log('Loading history from localStorage:', stored)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          console.log('Parsed history:', parsed)
          setHistory(parsed)
        } catch (error) {
          console.error('Error parsing conversion history:', error)
        }
      } else {
        console.log('No stored history found')
        setHistory([])
      }
    }

    loadHistory()

    // Listen for custom events to update history in real-time
    const handleHistoryUpdate = (e: CustomEvent) => {
      if (e.detail?.history) {
        setHistory(e.detail.history)
      } else {
        loadHistory()
      }
    }

    window.addEventListener(HISTORY_UPDATED_EVENT, handleHistoryUpdate as EventListener)
    return () => window.removeEventListener(HISTORY_UPDATED_EVENT, handleHistoryUpdate as EventListener)
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (history.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  }, [history])

  // Function to add a new conversion to history
  const addConversion = (conversion: Omit<ConversionItem, 'id' | 'convertedAt'>) => {
    const newConversion: ConversionItem = {
      ...conversion,
      id: Date.now().toString(),
      convertedAt: new Date().toLocaleString(),
    }

    setHistory(prev => [newConversion, ...prev.slice(0, 9)]) // Keep only last 10 items
  }

  // Function to remove a conversion from history
  const removeConversion = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id))
    toast({
      title: "Conversion Removed",
      description: "The conversion has been removed from your history.",
    })
  }

  // Function to clear all history
  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
    toast({
      title: "History Cleared",
      description: "All conversion history has been cleared.",
    })
  }

  // Function to copy original URL to clipboard
  const copyOriginalUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast({
        title: "URL Copied",
        description: "The original YouTube URL has been copied to your clipboard.",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard.",
        variant: "destructive",
      })
    }
  }

  // Function to open original YouTube video
  const openOriginalVideo = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Filter history based on search term
  const filteredHistory = history.filter(item =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Function to re-download a previous conversion
  const reDownloadConversion = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}?download=1`)

      if (!response.ok) {
        throw new Error('File no longer available')
      }

      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'converted-audio.mp3'

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Download Started",
        description: "Your previous conversion is being downloaded.",
      })
    } catch (error) {
      console.error('Error re-downloading file:', error)
      toast({
        title: "Download Failed",
        description: "This file is no longer available for download.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Recent Conversions</h3>
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={clearHistory}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
        
        {history.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {history.length > 0 ? (
          filteredHistory.length > 0 ? filteredHistory.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 p-4 bg-accent/30 rounded-lg border border-border/60 hover:bg-accent/50 transition-colors"
          >
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-700">
              <img
                src={item.thumbnail || "/placeholder.svg"}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/placeholder.svg";
                }}
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <FileAudio className="w-4 h-4 text-white/80" />
              </div>
            </div>

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
                {item.size && <span>{item.size}</span>}
                <span>{item.convertedAt}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => openOriginalVideo(item.url)}
                title="Open original video"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => copyOriginalUrl(item.url)}
                title="Copy original URL"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => reDownloadConversion(item.jobId)}
                title="Download again"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeConversion(item.id)}
                title="Remove from history"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )) : (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No conversions match your search</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No conversions yet</p>
            <p className="text-sm mt-1">Your converted files will appear here</p>
          </div>
        )}
      </div>

    </div>
  )
}
