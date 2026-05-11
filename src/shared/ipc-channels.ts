export const IPC = {
  // Tab management
  CREATE_TAB: "create-tab",
  CLOSE_TAB: "close-tab",
  SWITCH_TAB: "switch-tab",
  GET_TABS: "get-tabs",
  NAVIGATE_TAB: "navigate-tab",
  TAB_GO_BACK: "tab-go-back",
  TAB_GO_FORWARD: "tab-go-forward",
  TAB_RELOAD: "tab-reload",
  TAB_SCREENSHOT: "tab-screenshot",
  TAB_RUN_JS: "tab-run-js",
  GET_ACTIVE_TAB_INFO: "get-active-tab-info",
  TABS_UPDATED: "tabs-updated",

  // Sidebar
  TOGGLE_SIDEBAR: "toggle-sidebar",

  // Chat
  CHAT_SEND_MESSAGE: "sidebar-chat-message",
  CHAT_CLEAR: "sidebar-clear-chat",
  CHAT_GET_MESSAGES: "sidebar-get-messages",
  CHAT_RESPONSE: "chat-response",
  CHAT_MESSAGES_UPDATED: "chat-messages-updated",

  // Page content
  GET_PAGE_CONTENT: "get-page-content",
  GET_PAGE_TEXT: "get-page-text",
  GET_CURRENT_URL: "get-current-url",

  // Dark mode
  DARK_MODE_CHANGED: "dark-mode-changed",
  DARK_MODE_UPDATED: "dark-mode-updated",

  // Window
  WINDOW_RESIZED: "window-resized",
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
