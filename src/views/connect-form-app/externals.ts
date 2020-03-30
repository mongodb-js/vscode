declare module '*.less' {
  const resource: { [key: string]: string };

  export default resource;
}

declare const acquireVsCodeApi: () => any;
