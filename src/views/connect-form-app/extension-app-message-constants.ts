export enum MESSAGE_TYPES {
  CONNECT = 'CONNECT',
  CONNECT_RESULT = 'CONNECT_RESULT',
  OPEN_FILE_PICKER = 'OPEN_FILE_PICKER',
  FILE_PICKER_RESULTS = 'FILE_PICKER_RESULTS'
}

interface BasicWebviewMessage {
  command: string;
}

// Note: In the app this is tightly coupled with 'externals.ts'.
export interface ConnectMessage extends BasicWebviewMessage {
  command: 'CONNECT';
  driverUrl: string;
}

// Note: In the app this is tightly coupled with 'externals.ts'.
export interface FilePickerMessage {
  command: 'OPEN_FILE_PICKER';
  action: string;
  multi: boolean;
}
