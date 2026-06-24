export interface StorageInfo {
  total: number
  used: number
  free: number
  percent_used: number
}

export interface CounterInfo {
  photos: number
  videos: number
  total: number
}

export interface NetworkInfo {
  ip: string
  hostname: string
}

export interface StatusUpdate {
  recording: boolean
  interval: boolean
  counter: CounterInfo
  total: CounterInfo
  storage: StorageInfo
  network: NetworkInfo
}

export interface DateFolder {
  date: string
  photo_count: number
  video_count: number
  total_size: number
}

export interface FileItem {
  name: string
  type: 'image' | 'video'
  size: number
  path: string
  metadata: Record<string, unknown>
}

export interface AppSettings {
  camera: {
    resolution: string
    framerate: number
    exposure: string | number
    white_balance: string
  }
  interval: {
    interval_seconds: number
    max_shots: number
  }
  annotation: {
    default_sample_id: string
    default_note: string
    default_condition: string
  }
}
