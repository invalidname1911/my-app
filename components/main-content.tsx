"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Music, Sun, Moon, Download, Clipboard, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { useTheme } from "next-themes"
import { ConversionHistory, addToConversionHistory } from "@/components/conversion-history"
import { useToast } from "@/hooks/use-toast"

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function MainContent() {
  const [url, setUrl] = useState("")
  const [isConverting, setIsConverting] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()

  // Conversion state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [conversionProgress, setConversionProgress] = useState(0)
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'starting' | 'downloading' | 'converting' | 'completed' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [videoInfo, setVideoInfo] = useState<{ title?: string; duration?: string; thumbnail?: string } | null>(null)
  const [selectedQuality, setSelectedQuality] = useState("320")

  // Keep latest video info to avoid stale closures when scheduling downloads
  const latestVideoInfoRef = useRef<typeof videoInfo>(null)
  useEffect(() => {
    latestVideoInfoRef.current = videoInfo
  }, [videoInfo])

  // URL validation function
  const validateYouTubeUrl = useCallback((url: string): boolean => {
    if (!url.trim()) return false

    // Basic YouTube URL patterns
    const youtubePatterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/(www\.)?youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/
    ]

    return youtubePatterns.some(pattern => pattern.test(url))
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Function to start YouTube to MP3 conversion
  const startYouTubeConversion = useCallback(async (youtubeUrl: string, bitrate: number) => {
    try {
      const response = await fetch('/api/youtube-to-mp3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: youtubeUrl,
          bitrate: bitrate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start conversion')
      }

      return data
    } catch (error) {
      console.error('Error starting YouTube conversion:', error)
      throw error
    }
  }, [])

  // Function to poll job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status')
      }

      return data
    } catch (error) {
      console.error('Error polling job status:', error)
      throw error
    }
  }, [])

  // Function to download the converted file
  const downloadFile = useCallback(async (
    jobId: string,
    originalUrl: string,
    meta?: { title?: string; duration?: string; quality?: string },
    videoData?: { title?: string; duration?: string; thumbnail?: string }
  ) => {
    console.log('downloadFile called with jobId:', jobId, 'originalUrl:', originalUrl, 'meta:', meta, 'videoData:', videoData)
    try {
      const response = await fetch(`/api/jobs/${jobId}?download=1`)

      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'converted-audio.mp3'

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
      toast({
        title: "Download Complete",
        description: "Your MP3 file has been downloaded successfully!",
      })

      // Add to conversion history with file size
      // Prefer explicit params; fallback to latest stored info to avoid missing metadata
      const dataToUse = videoData || meta || latestVideoInfoRef.current || undefined

      if (dataToUse) {
        // Get file size from the blob
        const fileSize = blob.size
        const fileSizeFormatted = formatFileSize(fileSize)

        const historyTitle = dataToUse.title || 'YouTube Audio'
        const historyDuration = dataToUse.duration || ''
        const historyThumbnail = 'thumbnail' in dataToUse ? dataToUse.thumbnail : undefined

        console.log('About to add to conversion history:', {
          title: historyTitle,
          duration: historyDuration,
          quality: `${selectedQuality} kbps`,
          size: fileSizeFormatted,
          thumbnail: historyThumbnail,
          url: originalUrl,
          jobId: jobId,
        })

        addToConversionHistory({
          title: historyTitle,
          duration: historyDuration,
          quality: `${selectedQuality} kbps`,
          size: fileSizeFormatted,
          thumbnail: historyThumbnail,
          url: originalUrl, // Use the original YouTube URL
          jobId: jobId,
        })

        console.log('Successfully added to conversion history!')
      } else {
        console.log('No data available, not adding to history')
      }
    } catch (error) {
      console.error('Error downloading file:', error)
      toast({
        title: "Download Failed",
        description: "Failed to download the converted file. Please try again.",
        variant: "destructive",
      })
    }
  }, [toast, selectedQuality, videoInfo])

  // Function to reset conversion state
  const resetConversion = useCallback(() => {
    setCurrentJobId(null)
    setConversionProgress(0)
    setConversionStatus('idle')
    setErrorMessage("")
    setVideoInfo(null)
    setIsConverting(false)
  }, [])

  // Function to handle the conversion process
  const handleConvert = async () => {
    if (!url.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a YouTube URL to convert.",
        variant: "destructive",
      })
      return
    }

    if (!validateYouTubeUrl(url)) {
      toast({
        title: "Invalid YouTube URL",
        description: "Please enter a valid YouTube URL (youtube.com or youtu.be).",
        variant: "destructive",
      })
      return
    }

    // Reset previous state
    resetConversion()
    setIsConverting(true)
    setConversionStatus('starting')

    try {
      // Start the conversion
      const result = await startYouTubeConversion(url, parseInt(selectedQuality))
      const { jobId, title, duration, thumbnail } = result

      setCurrentJobId(jobId)
      setVideoInfo({ title, duration, thumbnail })
      setConversionStatus('downloading')

      toast({
        title: "Conversion Started",
        description: title ? `Converting: ${title}` : "Your YouTube video is being converted to MP3...",
      })

      // Poll for status updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await pollJobStatus(jobId)
          console.log('Poll status result:', status)

          setConversionProgress(status.progress || 0)

          if (status.status === 'running') {
            // Determine phase based on progress
            if (status.progress < 50) {
              setConversionStatus('downloading')
            } else {
              setConversionStatus('converting')
            }
          } else if (status.status === 'done') {
            console.log('Job completed! Status:', status)
            setConversionStatus('completed')
            setConversionProgress(100)
            clearInterval(pollInterval)

            // Auto-download after a short delay
            setTimeout(() => {
              const latest = latestVideoInfoRef.current || undefined
              console.log('About to call downloadFile with jobId:', jobId, 'and url:', url, 'videoInfo:', latest)
              downloadFile(jobId, url, undefined, latest)
              resetConversion()
              setUrl("")
            }, 1000)

          } else if (status.status === 'error') {
            setConversionStatus('error')
            setErrorMessage(status.error || 'Conversion failed')
            clearInterval(pollInterval)
            setIsConverting(false)

            toast({
              title: "Conversion Failed",
              description: status.error || "An error occurred during conversion.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error('Error polling status:', error)
          setConversionStatus('error')
          setErrorMessage('Failed to check conversion status')
          clearInterval(pollInterval)
          setIsConverting(false)

          toast({
            title: "Connection Error",
            description: "Lost connection to the server. Please try again.",
            variant: "destructive",
          })
        }
      }, 2000) // Poll every 2 seconds

      // Clear interval after 5 minutes as safety measure
      setTimeout(() => {
        clearInterval(pollInterval)
        if (conversionStatus !== 'completed' && conversionStatus !== 'error') {
          setConversionStatus('error')
          setErrorMessage('Conversion timed out')
          setIsConverting(false)
        }
      }, 300000) // 5 minutes

    } catch (error: any) {
      console.error('Error starting conversion:', error)
      setConversionStatus('error')
      setErrorMessage(error.message || 'Failed to start conversion')
      setIsConverting(false)

      toast({
        title: "Conversion Failed",
        description: error.message || "Failed to start the conversion. Please check the URL and try again.",
        variant: "destructive",
      })
    }
  }

  // Paste from clipboard handler
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
      if (validateYouTubeUrl(text)) {
        toast({
          title: "URL Pasted",
          description: "YouTube URL detected and ready to convert!",
        })
      }
    } catch {
      toast({
        title: "Paste Failed",
        description: "Unable to access clipboard. Please paste manually.",
        variant: "destructive",
      })
    }
  }

  // Estimate conversion time based on video duration
  const getEstimatedTime = () => {
    if (!videoInfo?.duration) return "~30 seconds"
    // Parse duration like "3:45" or "1:23:45"
    const parts = videoInfo.duration.split(':').map(Number)
    let totalSeconds = 0
    if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1]
    else if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
    // Rough estimate: 1 minute of video = ~5 seconds to convert
    const estimatedSeconds = Math.max(10, Math.ceil(totalSeconds / 12))
    return estimatedSeconds < 60 ? `~${estimatedSeconds} seconds` : `~${Math.ceil(estimatedSeconds / 60)} minute(s)`
  }

  return (
    <div className="flex-1 flex flex-col gradient-bg">
      {/* Header */}
      <header className="h-16 border-b border-border/50 backdrop-blur-sm bg-background/80 flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">YouTube to MP3</h1>
        </div>

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* URL Input Section */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-lg animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">YouTube to MP3 Converter</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-6">Paste a YouTube URL below to convert it to MP3 format</p>

            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isConverting}
                    className="flex-1 bg-input/50 border-border/50 placeholder:text-muted-foreground pr-10 h-11 rounded-xl transition-all focus:ring-2 focus:ring-primary/20"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePaste}
                    disabled={isConverting}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    aria-label="Paste from clipboard"
                  >
                    <Clipboard className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleConvert}
                  disabled={!url.trim() || !validateYouTubeUrl(url) || isConverting}
                  className={`px-6 h-11 rounded-xl font-medium transition-all ${
                    isConverting ? 'animate-pulse-glow' : 'hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {isConverting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {conversionStatus === 'starting' && 'Starting...'}
                      {conversionStatus === 'downloading' && 'Downloading...'}
                      {conversionStatus === 'converting' && 'Converting...'}
                      {conversionStatus === 'completed' && 'Completing...'}
                      {conversionStatus === 'error' && 'Error'}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Convert
                    </>
                  )}
                </Button>
              </div>

              {/* Progress and Status Display */}
              {isConverting && (
                <div className="space-y-4 animate-fade-in-up">
                  {/* Video Preview Card */}
                  {videoInfo && (
                    <div className="flex gap-4 p-4 bg-accent/30 rounded-xl border border-border/30">
                      {videoInfo.thumbnail && (
                        <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-md">
                          <img 
                            src={videoInfo.thumbnail} 
                            alt={videoInfo.title || 'Video thumbnail'}
                            className="w-full h-full object-cover"
                          />
                          {/* Audio wave animation overlay */}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-1">
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-white rounded-full animate-wave"
                                style={{
                                  height: '60%',
                                  animationDelay: `${i * 0.15}s`
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {videoInfo.title && (
                          <div className="font-medium text-sm truncate mb-1">{videoInfo.title}</div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {videoInfo.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {videoInfo.duration}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {selectedQuality} kbps
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Estimated time: {getEstimatedTime()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {conversionStatus === 'starting' && 'Initializing conversion...'}
                        {conversionStatus === 'downloading' && 'Downloading video from YouTube...'}
                        {conversionStatus === 'converting' && 'Converting to MP3...'}
                        {conversionStatus === 'completed' && 'Conversion completed!'}
                        {conversionStatus === 'error' && 'Conversion failed'}
                      </span>
                      <span className="font-medium tabular-nums">{conversionProgress}%</span>
                    </div>

                    <div className="w-full bg-accent/30 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-primary/80 h-full rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${conversionProgress}%` }}
                      >
                        <div className="absolute inset-0 animate-shimmer" />
                      </div>
                    </div>
                  </div>

                  {conversionStatus === 'error' && errorMessage && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-4">
                      {errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conversion Options */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-lg animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="mb-4">
              <h3 className="text-lg font-medium">Conversion Options</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quality */}
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Quality</label>
                {mounted ? (
                  <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                    <SelectTrigger className="bg-input/50 border-border/50 h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-sm border-border/50 rounded-xl">
                      <SelectItem value="128">128 kbps</SelectItem>
                      <SelectItem value="192">192 kbps</SelectItem>
                      <SelectItem value="320">320 kbps (Recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="bg-input/50 border-border/50 border rounded-xl px-3 py-2 text-sm h-11 flex items-center">
                    {selectedQuality} kbps {selectedQuality === "320" ? "(Recommended)" : ""}
                  </div>
                )}
              </div>

              {/* Format */}
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">Format</label>
                {mounted ? (
                  <Select defaultValue="mp3">
                    <SelectTrigger className="bg-input/50 border-border/50 h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card/95 backdrop-blur-sm border-border/50 rounded-xl">
                      <SelectItem value="mp3">MP3</SelectItem>
                      <SelectItem value="wav">WAV</SelectItem>
                      <SelectItem value="flac">FLAC</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="bg-input/50 border-border/50 border rounded-xl px-3 py-2 text-sm h-11 flex items-center">
                    MP3
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Conversions */}
          <ConversionHistory />

          {/* Help Section */}
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 p-6 shadow-lg animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-medium mb-3">How to Use?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/30">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">1</div>
                <p className="text-muted-foreground">Paste a YouTube URL or use the clipboard button</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/30">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">2</div>
                <p className="text-muted-foreground">Select your preferred quality and format</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/30">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-primary">3</div>
                <p className="text-muted-foreground">Click Convert and download your MP3</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
