import { useEffect, useState } from 'react';
import {
  type MessageFromExtensionToWebview,
  MessageType,
} from './extension-app-message-constants';

export const useDetectVsCodeDarkMode = (): boolean => {
  const [darkModeDetected, setDarkModeDetected] = useState(
    globalThis.document.body.classList.contains('vscode-dark') ||
      globalThis.document.body.classList.contains('vscode-high-contrast'),
  );
  useEffect(() => {
    const onThemeChanged = (event): void => {
      const message: MessageFromExtensionToWebview = event.data;
      if (message.command === MessageType.themeChanged) {
        setDarkModeDetected(message.darkMode);
      }
    };
    window.addEventListener('message', onThemeChanged);
    return (): void => window.removeEventListener('message', onThemeChanged);
  }, []);

  return darkModeDetected;
};
