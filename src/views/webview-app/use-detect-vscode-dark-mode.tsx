import { useEffect, useState } from 'react';
import {
  type MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
  MESSAGE_TYPES,
} from './extension-app-message-constants';

export const useDetectVsCodeDarkMode = () => {
  const [darkModeDetected, setDarkModeDetected] = useState(
    globalThis.document.body.classList.contains('vscode-dark') ||
      globalThis.document.body.classList.contains('vscode-high-contrast')
  );
  useEffect(() => {
    const onThemeChanged = (event) => {
      const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;
      if (message.command === MESSAGE_TYPES.THEME_CHANGED) {
        setDarkModeDetected(message.darkMode);
      }
    };
    window.addEventListener('message', onThemeChanged);
    return () => window.removeEventListener('message', onThemeChanged);
  }, []);

  return darkModeDetected;
};
