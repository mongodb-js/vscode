declare module '*.less' {
  const resource: { [key: string]: string };

  export default resource;
}

declare module '*.svg' {
  const content: any;
  export default content;
}

interface BasicWebviewMessage {
  command: string;
}

interface ConnectMessage extends BasicWebviewMessage {
  command: 'CONNECT';
  connectionModel: object;
}

interface CreateNewPlaygroundMessage extends BasicWebviewMessage {
  command: 'CREATE_NEW_PLAYGROUND';
}

interface OpenConnectionStringInputMessage extends BasicWebviewMessage {
  command: 'OPEN_CONNECTION_STRING_INPUT';
}

interface LinkClickedMessage extends BasicWebviewMessage {
  command: 'EXTENSION_LINK_CLICKED';
}

interface FilePickerMessage {
  command: 'OPEN_FILE_PICKER';
  action: string;
  multi: boolean;
}

type WebviewMessage =
  | ConnectMessage
  | FilePickerMessage
  | LinkClickedMessage
  | OpenConnectionStringInputMessage;

interface VSCodeApi {
  postMessage: (message: WebviewMessage) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
