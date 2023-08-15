import type { Logger as ILogger } from 'ts-log';
import * as vscode from 'vscode';
import util from 'util';

class Logger implements ILogger {
  static channel: vscode.OutputChannel =
    vscode.window.createOutputChannel('MongoDB Extension');

  private name: string;

  public constructor(name: string) {
    // https://code.visualstudio.com/api/references/vscode-api#window.createOutputChannel
    this.name = name;
  }

  public trace(message?: any, ...optionalParams: any[]): void {
    this.append(
      'TRACE',
      `${message} ${optionalParams ? util.inspect(optionalParams) : ''}`
    );
  }

  public debug(message?: any, ...optionalParams: any[]): void {
    this.append(
      'DEBUG',
      `${message} ${optionalParams ? util.inspect(optionalParams) : ''}`
    );
  }

  public info(message?: any, ...optionalParams: any[]): void {
    this.append(
      'INFO ',
      `${message} ${optionalParams ? util.inspect(optionalParams) : ''}`
    );
  }

  public warn(message?: any, ...optionalParams: any[]): void {
    this.append(
      'WARN ',
      `${message} ${optionalParams ? util.inspect(optionalParams) : ''}`
    );
  }

  public error(message?: any, ...optionalParams: any[]): void {
    this.append(
      'ERROR',
      `${message} ${optionalParams ? util.inspect(optionalParams) : ''}`
    );
  }

  private append(type: string, message: string) {
    // https://code.visualstudio.com/api/references/vscode-api#window.createOutputChannel

    Logger.channel.appendLine(
      `${new Date().toISOString()} ${this.name} ${type} ${message}\n`
    );
  }
}

export const createLogger = (name: string): Logger => {
  return new Logger(name);
};
