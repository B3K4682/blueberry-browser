import React from 'react'
import { Plus, X } from 'lucide-react'
import { useBrowser } from '../contexts/BrowserContext'
import { Favicon } from '../components/Favicon'
import { TabBarButton } from '../components/TabBarButton'
import { cn } from '@common/lib/utils'

interface TabItemProps {
    id: string
    title: string
    favicon?: string | null
    isActive: boolean
    isPinned?: boolean
    onClose: () => void
    onActivate: () => void
}

const TabItem: React.FC<TabItemProps> = ({
    title,
    favicon,
    isActive,
    isPinned = false,
    onClose,
    onActivate
}) => {
    const baseClassName = cn(
        "relative flex items-center h-8 pl-2 pr-1.5 select-none rounded-md",
        "text-primary group/tab transition-all duration-200 cursor-pointer",
        "app-region-no-drag", // Make tabs clickable
        isActive
            ? "bg-background shadow-tab dark:bg-secondary dark:shadow-none"
            : "bg-transparent hover:bg-muted/50 dark:hover:bg-muted/30",
        isPinned ? "w-8 !px-0 justify-center" : ""
    )

    return (
        <div
            className={cn(
                'py-1 px-0.5',
                isPinned
                    ? 'min-w-8 max-w-8 shrink-0'
                    : 'min-w-0 max-w-[200px] shrink'
            )}
        >
            <div
                className={cn(
                    baseClassName,
                    !isPinned && 'w-full min-w-0 max-w-full overflow-hidden'
                )}
                onClick={() => !isActive && onActivate()}
            >
                {/* Favicon */}
                <div className={cn('shrink-0', !isPinned && 'mr-2')}>
                    <Favicon src={favicon} />
                </div>

                {/* Title (hide for pinned tabs); min-w-0 so ellipsis works when tab shrinks */}
                {!isPinned && (
                    <span className="min-w-0 flex-1 truncate text-xs" title={title || 'New Tab'}>
                        {title || 'New Tab'}
                    </span>
                )}

                {/* Close button (shows on hover) */}
                {!isPinned && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            onClose()
                        }}
                        className={cn(
                            "flex-shrink-0 p-1 rounded-md transition-opacity",
                            "hover:bg-muted dark:hover:bg-muted/50",
                            "opacity-0 group-hover/tab:opacity-100",
                            isActive && "opacity-100"
                        )}
                    >
                        <X className="size-3 text-primary dark:text-primary" />
                    </div>
                )}
            </div>
        </div>
    )
}

export const TabBar: React.FC = () => {
    const { tabs, createTab, closeTab, switchTab } = useBrowser()

    const handleCreateTab = () => {
        createTab('https://www.google.com')
    }

    const getFavicon = (url: string) => {
        try {
            const domain = new URL(url).hostname
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
        } catch {
            return null
        }
    }

    return (
        <div className="group/tabbar app-region-drag flex-1 h-full min-h-0 min-w-0 overflow-x-hidden flex items-center">
            <div className="pl-20 shrink-0" />
            <div className="flex min-w-0 flex-1 items-center overflow-hidden">
                {/* Width follows tabs; does not grow—so + stays next to last tab */}
                <div className="flex min-w-0 max-w-full shrink overflow-x-auto">
                    {tabs.map(tab => (
                        <TabItem
                            key={tab.id}
                            id={tab.id}
                            title={tab.title}
                            favicon={getFavicon(tab.url)}
                            isActive={tab.isActive}
                            onClose={() => closeTab(tab.id)}
                            onActivate={() => switchTab(tab.id)}
                        />
                    ))}
                </div>
                <div
                    className={cn(
                        'shrink-0 pl-1 pr-1 opacity-0 transition-opacity duration-200 ease-out',
                        'group-hover/tabbar:opacity-100'
                    )}
                >
                    <TabBarButton Icon={Plus} onClick={handleCreateTab} />
                </div>
                <div className="min-w-0 flex-1" aria-hidden />
            </div>
        </div>
    )
}

