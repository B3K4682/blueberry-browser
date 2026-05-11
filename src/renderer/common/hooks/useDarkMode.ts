import { useState, useEffect } from "react";
import { IPC } from "@shared/ipc-channels";

export const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      return JSON.parse(savedMode);
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));

    if (window.electron) {
      window.electron.ipcRenderer.send(IPC.DARK_MODE_CHANGED, isDarkMode);
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleDarkModeUpdate = (_event: any, newDarkMode: boolean) => {
      setIsDarkMode(newDarkMode);
    };

    if (window.electron) {
      window.electron.ipcRenderer.on(IPC.DARK_MODE_UPDATED, handleDarkModeUpdate);
    }

    return () => {
      if (window.electron) {
        window.electron.ipcRenderer.removeListener(
          IPC.DARK_MODE_UPDATED,
          handleDarkModeUpdate
        );
      }
    };
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return { isDarkMode, toggleDarkMode };
};
