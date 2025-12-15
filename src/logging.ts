import type { Logger as ILogger } from 'ts-log';
import * as vscode from 'vscode';
import util from 'util';

class Logger implements ILogger {
  static channel: vscode.LogOutputChannel = vscode.window.createOutputChannel(
    'MongoDB Extension',
    { log: true },
  );

  private name: string;

  public constructor(name: string) {
    // https://code.visualstudio.com/api/references/vscode-api#window.createOutputChannel
    this.name = name;
  }

  private formatMessage(message?: any, ...optionalParams: any[]): string {
    return `[${this.name}] ${message} ${
      optionalParams.length ? util.inspect(optionalParams) : ''
    }`;
  }

  public trace(message?: any, ...optionalParams: any[]): void {
    Logger.channel.trace(this.formatMessage(message, ...optionalParams));
  }

  public debug(message?: any, ...optionalParams: any[]): void {
    Logger.channel.debug(this.formatMessage(message, ...optionalParams));
  }

  public info(message?: any, ...optionalParams: any[]): void {
    Logger.channel.info(this.formatMessage(message, ...optionalParams));
  }

  public warn(message?: any, ...optionalParams: any[]): void {
    Logger.channel.warn(this.formatMessage(message, ...optionalParams));
  }

  public error(message?: any, ...optionalParams: any[]): void {
    Logger.channel.error(this.formatMessage(message, ...optionalParams));
  }

  public fatal(message?: any, ...optionalParams: any[]): void {
    Logger.channel.error(
      `FATAL: ${this.formatMessage(message, ...optionalParams)}`,
    );
  }
}

export const createLogger = (name: string): Logger => {
  return new Logger(name);
};
