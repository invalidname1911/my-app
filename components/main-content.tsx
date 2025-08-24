"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, Sun, Moon, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useTheme } from "next-themes"
import { ConversionHistory } from "@/components/conversion-history"

export function MainContent() {
  const [url, setUrl] = useState("")
  const [isConverting, setIsConverting] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConvert = async () => {
    if (!url.trim()) return

    setIsConverting(true)
    // Placeholder conversion logic
    await new Promise((resolve) => setTimeout(resolve, 3000))
    setIsConverting(false)
    setUrl("")
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold">Converter</h1>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Limited</span>
          <span className="text-sm text-muted-foreground">Free Plan</span>
          <Button variant="outline" size="sm" className="border-border text-foreground hover:text-foreground bg-transparent">
            Upgrade
          </Button>
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* URL Input Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">YouTube to MP3 Converter</h2>
            <p className="text-muted-foreground text-sm mb-6">Paste a YouTube URL below to convert it to MP3 format</p>

            <div className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-input border-border placeholder:text-muted-foreground"
                />
                <Button
                  onClick={handleConvert}
                  disabled={!url.trim() || isConverting}
                  className="px-8"
                >
                  {isConverting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Convert
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Conversion Options */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Conversion Options</h3>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                <span className="text-xs">Advanced Options</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Quality */}
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Quality</label>
                <Select defaultValue="320">
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="128">128 kbps</SelectItem>
                    <SelectItem value="192">192 kbps</SelectItem>
                    <SelectItem value="320">320 kbps (Recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Format */}
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Format</label>
                <Select defaultValue="mp3">
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="mp3">MP3</SelectItem>
                    <SelectItem value="wav">WAV</SelectItem>
                    <SelectItem value="flac">FLAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Speed */}
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Speed</label>
                <Select defaultValue="normal">
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="fast">Fast</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="slow">High Quality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="trim-silence" className="border-border" />
                  <label htmlFor="trim-silence" className="text-sm text-foreground/80">
                    Trim Silence
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="normalize-audio" className="border-border" />
                  <label htmlFor="normalize-audio" className="text-sm text-foreground/80">
                    Normalize Audio
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="add-metadata" className="border-border" defaultChecked />
                  <label htmlFor="add-metadata" className="text-sm text-foreground/80">
                    Add Metadata
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="auto-download" className="border-border" />
                  <label htmlFor="auto-download" className="text-sm text-foreground/80">
                    Auto Download
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Conversions */}
          <ConversionHistory />

          {/* Help Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-medium mb-2">How to Use?</h3>
            <p className="text-muted-foreground text-sm">
              Simply paste a YouTube URL, select your preferred quality and format, then click Convert. Your MP3 file
              will be ready for download in seconds.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
