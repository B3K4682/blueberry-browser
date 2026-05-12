import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { TabInfo } from '@shared/types'

interface BrowserContextType {
    tabs: TabInfo[]
    activeTab: TabInfo | null
    isLoading: boolean

    createTab: (url?: string) => Promise<void>
    closeTab: (tabId: string) => Promise<void>
    switchTab: (tabId: string) => Promise<void>
    refreshTabs: () => Promise<void>

    navigateToUrl: (url: string) => Promise<void>
    goBack: () => Promise<void>
    goForward: () => Promise<void>
    reload: () => Promise<void>

    takeScreenshot: (tabId: string) => Promise<string | null>
    runJavaScript: (tabId: string, code: string) => Promise<any>
}

const BrowserContext = createContext<BrowserContextType | null>(null)

export const useBrowser = () => {
    const context = useContext(BrowserContext)
    if (!context) {
        throw new Error('useBrowser must be used within a BrowserProvider')
    }
    return context
}

export const BrowserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tabs, setTabs] = useState<TabInfo[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const activeTab = tabs.find(tab => tab.isActive) || null

    const refreshTabs = useCallback(async () => {
        try {
            const tabsData = await window.topBarAPI.getTabs()
            setTabs(tabsData)
        } catch (error) {
            console.error('Failed to refresh tabs:', error)
        }
    }, [])

    const createTab = useCallback(async (url?: string) => {
        setIsLoading(true)
        try {
            await window.topBarAPI.createTab(url)
        } catch (error) {
            console.error('Failed to create tab:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const closeTab = useCallback(async (tabId: string) => {
        setIsLoading(true)
        try {
            await window.topBarAPI.closeTab(tabId)
        } catch (error) {
            console.error('Failed to close tab:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const switchTab = useCallback(async (tabId: string) => {
        setIsLoading(true)
        try {
            await window.topBarAPI.switchTab(tabId)
        } catch (error) {
            console.error('Failed to switch tab:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const navigateToUrl = useCallback(async (url: string) => {
        if (!activeTab) return
        setIsLoading(true)
        try {
            await window.topBarAPI.navigateTab(activeTab.id, url)
        } catch (error) {
            console.error('Failed to navigate:', error)
        } finally {
            setIsLoading(false)
            await refreshTabs()
        }
    }, [activeTab, refreshTabs])

    const goBack = useCallback(async () => {
        if (!activeTab) return
        try {
            await window.topBarAPI.goBack(activeTab.id)
        } catch (error) {
            console.error('Failed to go back:', error)
        } finally {
            await refreshTabs()
        }
    }, [activeTab, refreshTabs])

    const goForward = useCallback(async () => {
        if (!activeTab) return
        try {
            await window.topBarAPI.goForward(activeTab.id)
        } catch (error) {
            console.error('Failed to go forward:', error)
        } finally {
            await refreshTabs()
        }
    }, [activeTab, refreshTabs])

    const reload = useCallback(async () => {
        if (!activeTab) return
        try {
            await window.topBarAPI.reload(activeTab.id)
        } catch (error) {
            console.error('Failed to reload:', error)
        }
    }, [activeTab])

    const takeScreenshot = useCallback(async (tabId: string) => {
        try {
            return await window.topBarAPI.tabScreenshot(tabId)
        } catch (error) {
            console.error('Failed to take screenshot:', error)
            return null
        }
    }, [])

    const runJavaScript = useCallback(async (tabId: string, code: string) => {
        try {
            return await window.topBarAPI.tabRunJs(tabId, code)
        } catch (error) {
            console.error('Failed to run JavaScript:', error)
            return null
        }
    }, [])

    // Fetch tabs once on mount
    useEffect(() => {
        refreshTabs()
    }, [refreshTabs])

    // Listen for tab state changes pushed from the main process
    useEffect(() => {
        window.topBarAPI.onTabsUpdated((updatedTabs) => {
            setTabs(updatedTabs)
        })
        return () => {
            window.topBarAPI.removeTabsUpdatedListener()
        }
    }, [])

    const value: BrowserContextType = {
        tabs,
        activeTab,
        isLoading,
        createTab,
        closeTab,
        switchTab,
        refreshTabs,
        navigateToUrl,
        goBack,
        goForward,
        reload,
        takeScreenshot,
        runJavaScript
    }

    return (
        <BrowserContext.Provider value={value}>
            {children}
        </BrowserContext.Provider>
    )
}
