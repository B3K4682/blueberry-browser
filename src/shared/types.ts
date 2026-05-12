export interface TabInfo {
  id: string
  title: string
  url: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface ChatRequest {
  message: string
  messageId: string
}

export interface ChatResponse {
  messageId: string
  content: string
  isComplete: boolean
}

export interface StreamChunk {
  content: string
  isComplete: boolean
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  isStreaming?: boolean
}
