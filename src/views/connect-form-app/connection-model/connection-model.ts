// This connection model is a browser version of https://github.com/mongodb-js/connection-model
// It mostly stores and validates data.

// Options: Message pass with main and keep the data model on the extension.
//  - Does this take a lot of messages? not real time? Things might get lost?
//  - Might be clean... How do differentiate state input though.
//  - Hacky - probably don't do.
// Have our own connection model here.
//  - Loaded at the end to the extension which builds into current connection model.
//  - Most straight forward solution
//  - Code duplication with connection model though.
//  - A good amount of code pulling connection model over and ensuring it can
//    rehydrated when passed to main.
// Reformat connection model to have a websafe version??
//  - How do we do some of the validation and breaking of file handling out.
//  - Would be nice...
//  - ssh tunneling?
//  - Connections and driver still needs to be used at some point which I think make
//    this infeasible.

import { ReadPreference } from 'mongodb';

import CONNECTION_TYPE_VALUES from './constants/connection-type-values';
import AUTH_MECHANISM_TO_AUTH_STRATEGY from './constants/auth-mechanism-to-auth-strategy';
import AUTHENICATION_TO_AUTH_MECHANISM from './constants/auth-strategy-to-auth-mechanism';
import AUTH_STRATEGY_VALUES from './constants/auth-strategy-values';
import AUTH_STRATEGY_TO_FIELD_NAMES from './constants/auth-strategy-to-field-names';
import SSL_METHOD_VALUES from './constants/ssl-method-values';
import SSH_TUNNEL_VALUES from './constants/ssh-tunnel-values';
const READ_PREFERENCE_VALUES = [
  ReadPreference.PRIMARY,
  ReadPreference.PRIMARY_PREFERRED,
  ReadPreference.SECONDARY,
  ReadPreference.SECONDARY_PREFERRED,
  ReadPreference.NEAREST
];

/**
 * Defining default values
 */
const AUTH_STRATEGY_DEFAULT = AUTH_STRATEGY_VALUES.NONE;
const READ_PREFERENCE_DEFAULT = ReadPreference.PRIMARY;
const MONGODB_DATABASE_NAME_DEFAULT = 'admin';
const KERBEROS_SERVICE_NAME_DEFAULT = 'mongodb';
const SSL_DEFAULT = 'NONE';
const SSH_TUNNEL_DEFAULT = 'NONE';
const DRIVER_OPTIONS_DEFAULT = { connectWithNoPrimary: true };

type host = {
  host: string;
  port: number;
};

export default class ConnectionModel {
  ns: string | null = null;
  isSrvRecord = false;
  hostname = 'localhost';
  port = 27017;
  hosts: host[] = [{ host: 'localhost', port: 27017 }];
  extraOptions = {};
  connectionType: CONNECTION_TYPE_VALUES = CONNECTION_TYPE_VALUES.NODE_DRIVER;
  authStrategy: AUTH_STRATEGY_VALUES = AUTH_STRATEGY_DEFAULT;

  //
}
