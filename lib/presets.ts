/**
 * FFmpeg presets for different output targets
 * These presets provide optimized settings for web and mobile playback
 */
export const presets = {
  /**
   * Web preset - optimized for desktop browsers
   * Higher quality, suitable for good network conditions
   */
  web: {
    vcodec: 'libx264',    // H.264 video codec
    acodec: 'aac',        // AAC audio codec
    crf: 23,              // Constant Rate Factor (lower = higher quality)
    scale: '1280x720'     // 720p resolution
  },
  
  /**
   * Mobile preset - optimized for mobile devices
   * Lower quality/bitrate for mobile networks and smaller screens
   */
  mobile: {
    vcodec: 'libx264',    // H.264 video codec
    acodec: 'aac',        // AAC audio codec
    crf: 26,              // Higher CRF for smaller file size
    scale: '854x480'      // 480p resolution
  }
} as const;

export type PresetKey = keyof typeof presets;

/**
 * Audio bitrates for MP3 conversion
 */
export const audioBitrates = {
  low: 128,      // 128 kbps
  medium: 192,   // 192 kbps (default)
  high: 320      // 320 kbps
} as const;

export type AudioBitrateKey = keyof typeof audioBitrates;

/**
 * Get preset configuration by key
 * @param preset The preset key
 * @returns Preset configuration object
 */
export function getPreset(preset: PresetKey) {
  return presets[preset];
}

/**
 * Get audio bitrate by key
 * @param bitrate The bitrate key
 * @returns Bitrate value in kbps
 */
export function getAudioBitrate(bitrate: AudioBitrateKey = 'medium'): number {
  return audioBitrates[bitrate];
}

/**
 * Validate if a preset key is valid
 * @param preset The preset key to validate
 * @returns True if valid, false otherwise
 */
export function isValidPreset(preset: string): preset is PresetKey {
  return preset in presets;
}

/**
 * Validate if an audio bitrate key is valid
 * @param bitrate The bitrate key to validate
 * @returns True if valid, false otherwise
 */
export function isValidAudioBitrate(bitrate: string): bitrate is AudioBitrateKey {
  return bitrate in audioBitrates;
}
