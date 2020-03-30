declare module '*.less' {
  const resource: { [key: string]: string };
  // export = resource;
  export default resource;
}

declare const acquireVsCodeApi: () => any;
