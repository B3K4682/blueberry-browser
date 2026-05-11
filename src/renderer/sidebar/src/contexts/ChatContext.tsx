import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Message, ChatResponse } from '@shared/types'

interface ChatContextType {
    messages: Message[]
    isLoading: boolean

    sendMessage: (content: string) => Promise<void>
    clearChat: () => void

    getPageContent: () => Promise<string | null>
    getPageText: () => Promise<string | null>
    getCurrentUrl: () => Promise<string | null>
}

const ChatContext = createContext<ChatContextType | null>(null)

export const useChat = () => {
    const context = useContext(ChatContext)
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider')
    }
    return context
}

// Converts CoreMessage objects from the main process into frontend Message shapes
function convertCoreMessages(raw: any[]): Message[] {
    return raw.map((msg: any, index: number) => ({
        id: `msg-${index}`,
        role: msg.role,
        content: typeof msg.content === 'string'
            ? msg.content
            : msg.content.find((p: any) => p.type === 'text')?.text || '',
        timestamp: Date.now(),
        isStreaming: false,
    }))
}

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Load initial messages from main process
    useEffect(() => {
        const loadMessages = async () => {
            try {
                const stored = await window.sidebarAPI.getMessages()
                if (stored?.length > 0) {
                    setMessages(convertCoreMessages(stored))
                }
            } catch (error) {
                console.error('Failed to load messages:', error)
            }
        }
        loadMessages()
    }, [])

    const sendMessage = useCallback(async (content: string) => {
        setIsLoading(true)
        try {
            const messageId = Date.now().toString()
            await window.sidebarAPI.sendChatMessage({ message: content, messageId })
        } catch (error) {
            console.error('Failed to send message:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const clearChat = useCallback(async () => {
        try {
            await window.sidebarAPI.clearChat()
            setMessages([])
        } catch (error) {
            console.error('Failed to clear chat:', error)
        }
    }, [])

    const getPageContent = useCallback(async () => {
        try {
            return await window.sidebarAPI.getPageContent()
        } catch (error) {
            console.error('Failed to get page content:', error)
            return null
        }
    }, [])

    const getPageText = useCallback(async () => {
        try {
            return await window.sidebarAPI.getPageText()
        } catch (error) {
            console.error('Failed to get page text:', error)
            return null
        }
    }, [])

    const getCurrentUrl = useCallback(async () => {
        try {
            return await window.sidebarAPI.getCurrentUrl()
        } catch (error) {
            console.error('Failed to get current URL:', error)
            return null
        }
    }, [])

    // Listen for streaming responses and message updates from the main process
    useEffect(() => {
        const handleChatResponse = (data: ChatResponse) => {
            if (data.isComplete) {
                setIsLoading(false)
            }
        }

        const handleMessagesUpdated = (updatedMessages: any[]) => {
            setMessages(convertCoreMessages(updatedMessages))
        }

        window.sidebarAPI.onChatResponse(handleChatResponse)
        window.sidebarAPI.onMessagesUpdated(handleMessagesUpdated)

        return () => {
            window.sidebarAPI.removeChatResponseListener()
            window.sidebarAPI.removeMessagesUpdatedListener()
        }
    }, [])

    const value: ChatContextType = {
        messages,
        isLoading,
        sendMessage,
        clearChat,
        getPageContent,
        getPageText,
        getCurrentUrl
    }

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}
