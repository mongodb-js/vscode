import { isCancelError, raceWithAbort } from '@mongodb-js/compass-utils';
import type { ConnectionOptions, DataService } from 'mongodb-data-service';
import { connect } from 'mongodb-data-service';

import { createLogger } from './logging';
import LINKS from './utils/links';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require('../package.json');

const log = createLogger('connection attempt');

function isConnectionAttemptTerminatedError(err: Error) {
  return err?.name === 'MongoError' && err?.message === 'Topology closed';
}

export class ConnectionAttempt {
  _abortController: AbortController;
  _closed = false;
  _dataService: DataService | null = null;

  constructor(private _connectFn: typeof connect) {
    this._abortController = new AbortController();
  }

  connect(connectionOptions: ConnectionOptions): Promise<DataService | void> {
    log.info('Connection', 'Initiating connection attempt');

    return raceWithAbort(
      this._connect(connectionOptions),
      this._abortController.signal
    ).catch((err) => {
      if (!isCancelError(err)) throw err;
    });
  }

  cancelConnectionAttempt(): void {
    log.info('Connection', 'Canceling connection attempt');

    this._abortController.abort();
    void this._close();
  }

  isClosed(): boolean {
    return this._closed;
  }

  async _connect(
    connectionOptions: ConnectionOptions
  ): Promise<DataService | void> {
    if (this._closed) {
      return;
    }

    try {
      this._dataService = await this._connectFn({
        connectionOptions,
        productName: packageJSON.name,
        productDocsLink: LINKS.extensionDocs(),
        signal: this._abortController.signal,
        logger: log,
      });
      return this._dataService;
    } catch (err) {
      if (isConnectionAttemptTerminatedError(err as Error)) {
        log.debug('caught connection attempt closed error', err);
        return;
      }

      log.debug('connection attempt failed', err);
      throw err;
    }
  }

  async _close(): Promise<void> {
    if (this._closed) {
      return;
    }

    this._closed = true;

    if (!this._dataService) {
      log.debug('cancelled connection attempt');
      return;
    }

    try {
      await this._dataService.disconnect();
      log.debug('disconnected from connection attempt');
    } catch (err) {
      // When the disconnect fails, we free up the ui and we can
      // silently wait for the timeout if it's still attempting to connect.
      log.debug('error while disconnecting from connection attempt', err);
    }
  }
}

export function createConnectionAttempt(
  connectFn = connect
): ConnectionAttempt {
  return new ConnectionAttempt(connectFn);
}
