import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";
import { IPC } from "../shared/ipc-channels";
import type { ChatRequest, ChatResponse } from "../shared/types";

const sidebarAPI = {
  sendChatMessage: (request: ChatRequest) =>
    electronAPI.ipcRenderer.invoke(IPC.CHAT_SEND_MESSAGE, request),

  clearChat: () =>
    electronAPI.ipcRenderer.invoke(IPC.CHAT_CLEAR),

  getMessages: () =>
    electronAPI.ipcRenderer.invoke(IPC.CHAT_GET_MESSAGES),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on(IPC.CHAT_RESPONSE, (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    electronAPI.ipcRenderer.on(IPC.CHAT_MESSAGES_UPDATED, (_, messages) =>
      callback(messages)
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners(IPC.CHAT_RESPONSE);
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners(IPC.CHAT_MESSAGES_UPDATED);
  },

  getPageContent: () =>
    electronAPI.ipcRenderer.invoke(IPC.GET_PAGE_CONTENT),
  getPageText: () =>
    electronAPI.ipcRenderer.invoke(IPC.GET_PAGE_TEXT),
  getCurrentUrl: () =>
    electronAPI.ipcRenderer.invoke(IPC.GET_CURRENT_URL),

  getActiveTabInfo: () =>
    electronAPI.ipcRenderer.invoke(IPC.GET_ACTIVE_TAB_INFO),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
