import { Logger } from 'ts-log';

class ChannelLogger implements Logger {
  private channel;

  public constructor(name: string) {
    // https://code.visualstudio.com/api/references/vscode-api#window.createOutputChannel
    this.channel = window.createOutputChannel('mongodb');
  }

  public trace(message?: any, ...optionalParams: any[]): void {
    this.append('TRACE', `${message} ${JSON.stringify(optionalParams)}`);
  }

  public debug(message?: any, ...optionalParams: any[]): void {
    this.append('DEBUG', `${message} ${JSON.stringify(optionalParams)}`);
  }

  public info(message?: any, ...optionalParams: any[]): void {
    this.append('INFO ', `${message} ${JSON.stringify(optionalParams)}`);
  }

  public warn(message?: any, ...optionalParams: any[]): void {
    this.append('WARN ', `${message} ${JSON.stringify(optionalParams)}`);
  }

  public error(message?: any, ...optionalParams: any[]): void {
    this.append('ERROR', `${message} ${JSON.stringify(optionalParams)}`);
  }

  private append(type: string, message: string) {
    // https://code.visualstudio.com/api/references/vscode-api#window.createOutputChannel

    this.channel.appendLine(`${new Date().toISOString()} ${type} ${message}\n`);
  }
}
