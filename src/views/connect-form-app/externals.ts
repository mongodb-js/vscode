declare module '*.less' {
  const resource: { [key: string]: string };

  export default resource;
}

interface WebviewMessage {
  command: string;
  driverUrl: string;
}

interface VSCodeApi {
  postMessage: (message: WebviewMessage) => void;
}

declare const acquireVsCodeApi: () => VSCodeApi;
