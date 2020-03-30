const Reflux = require('reflux');
// const DataService = require('mongodb-data-service');
// const Connection = require('mongodb-connection-model/lib/model');
const Connection = require('../js-connection-model/model');
const StateMixin = require('reflux-state-mixin');
// const ipc = require('hadron-ipc');

import Actions from './actions';

/**
 * A default driverUrl.
 */
// const DEFAULT_DRIVER_URL =
// 'mongodb://localhost:27017/?readPreference=primary&ssl=false';

/**
 * All the authentication strategy related fields on the connection model, with
 * the exception of the method.
 */
const AUTH_FIELDS = [
  'mongodbUsername',
  'mongodbPassword',
  'mongodbDatabaseName',
  'kerberosPrincipal',
  'kerberosPassword',
  'kerberosServiceName',
  'x509Username',
  'ldapUsername',
  'ldapPassword'
];

/**
 * All the SSL related fields on the connection model, with the exception
 * of the method.
 */
const SSL_FIELDS = ['sslCA', 'sslCert', 'sslKey', 'sslPass'];

/**
 * All the ssh tunnel related fields on the connection model, with the
 * exception of the method.
 */
const SSH_TUNNEL_FIELDS = [
  'sshTunnelHostname',
  'sshTunnelPort',
  'sshTunnelBindToLocalPort',
  'sshTunnelUsername',
  'sshTunnelPassword',
  'sshTunnelIdentityFile',
  'sshTunnelPassphrase',
  'replicaSet'
];

/**
 * The store that backs the connect plugin.
 */
const Store = Reflux.createStore({
  mixins: [StateMixin.store],
  listenables: Actions,

  /** --- Reflux lifecycle methods ---  */

  /**
   * Gets the initial state of the store.
   *
   * @returns {Object} The state.
   */
  getInitialState() {
    return {
      currentConnection: new Connection(),
      // Hash for storing unchanged connections for the discard feature
      connections: {},
      // URL from connection string input
      customUrl: '',
      isValid: true,
      isConnected: false,
      errorMessage: null,
      syntaxErrorMessage: null,
      isHostChanged: false,
      isPortChanged: false,
      isModalVisible: false,
      isMessageVisible: false,
      isURIEditable: true,
      isEditURIConfirm: false,
      isSavedConnection: false,
      savedMessage: 'Saved to favorites'
    };
  },

  /** --- Reflux actions ---  */

  /**
   * Changes the auth source.
   *
   * @param {String} authSource - The auth source.
   */
  onAuthSourceChanged(authSource) {
    this.state.currentConnection.mongodbDatabaseName = authSource;
    this.trigger(this.state);
  },

  /**
   * Changes authStrategy
   *
   * @param {String} method - The auth strategy.
   */
  onAuthStrategyChanged(method) {
    this._clearAuthFields();
    this.state.currentConnection.authStrategy = method;
    this.trigger(this.state);
  },

  /**
   * Resests URL validation.
   */
  onConnectionFormChanged() {
    this.setState({
      isValid: true,
      errorMessage: null,
      syntaxErrorMessage: null
    });
  },

  /**
   * To connect through `DataService` we need a proper connection object.
   * In case of connecting via URI we need to parse URI first to get this object.
   * In case of connecting via the form we can skip a parsing stage and
   * validate instead the existing connection object.
   */
  onConnectClicked() {
    const currentConnection = this.state.currentConnection;

    // We replace custom appname with proper appname
    // to avoid sending malicious value to the server
    // currentConnection.appname = electron.remote.app.getName();

    if (!currentConnection.isValid()) {
      this.setState({
        isValid: false,
        errorMessage: 'The required fields can not be empty'
      });
    } else {
      this._connect(currentConnection);
    }
  },

  /**
   * Makes URI read-only again.
   */
  onHideURIClicked() {
    this.state.isURIEditable = false;
    this.state.customUrl = this.state.currentConnection.safeUrl;
    this.trigger(this.state);
  },

  /**
   * Changes customUrl.
   *
   * @param {String} customUrl - A connection string.
   */
  onCustomUrlChanged(customUrl) {
    this.state.errorMessage = null;
    this.state.syntaxErrorMessage = null;
    this.state.customUrl = customUrl;
    this.trigger(this.state);
  },

  /**
   * Disconnects the current connection.
   */
  onDisconnectClicked() {
    if (this.dataService) {
      this.dataService.disconnect(() => {
        this.appRegistry.emit('data-service-disconnected');
        this.state.isValid = true;
        this.state.isConnected = false;
        this.state.errorMessage = null;
        this.state.syntaxErrorMessage = null;
        this._saveConnection(this.state.currentConnection);

        this.dataService = undefined;
      });
    }
  },

  /**
   * Hides a modal with confirmation to proceed.
   */
  onEditURICanceled() {
    this.state.isEditURIConfirm = false;
    this.trigger(this.state);
  },

  /**
   * Shows a modal with confirmation to proceed.
   */
  onEditURIClicked() {
    this.state.isEditURIConfirm = true;
    this.trigger(this.state);
  },

  /**
   * Makes URI editable.
   */
  onEditURIConfirmed() {
    this.state.isURIEditable = true;
    this.state.customUrl = this.state.currentConnection.driverUrl;
    this.state.isEditURIConfirm = false;
    this.trigger(this.state);
  },

  /**
   * Visits external page.
   *
   * @param {String} href - A link to external page.
   * @param {String} event - appRegistry event.
   */
  onExternalLinkClicked(href, event) {
    // TODO: Does vscode allow this:
    window.open(href, '_new');

    if (event) {
      this.appRegistry.emit(event);
    }
  },

  /**
   * Changes the host name. If the hostname contains mongodb.net then
   * then its an Atlas instance and we change the SSL settings.
   *
   * @param {String} hostname - The hostname.
   */
  onHostnameChanged(hostname) {
    this.state.currentConnection.hostname = hostname.trim();
    this.state.isHostChanged = true;

    if (hostname.match(/mongodb\.net/i)) {
      this.state.currentConnection.sslMethod = 'SYSTEMCA';
    }

    this.trigger(this.state);
  },

  /**
   * Changes the password.
   *
   * @param {String} password - The password.
   */
  onPasswordChanged(password) {
    this.state.currentConnection.mongodbPassword = password;
    this.trigger(this.state);
  },

  /**
   * Changes the port.
   *
   * @param {String} port - The port.
   */
  onPortChanged(port) {
    this.state.currentConnection.port = port.trim();
    this.state.isPortChanged = true;
    this.trigger(this.state);
  },

  /**
   * Changes the read preference.
   *
   * @param {String} readPreference - The read preference.
   */
  onReadPreferenceChanged(readPreference) {
    this.state.currentConnection.readPreference = readPreference;
    this.trigger(this.state);
  },

  /**
   * Changes the replica set name.
   *
   * @param {String} replicaSet - The replica set name.
   */
  onReplicaSetChanged(replicaSet) {
    this.state.currentConnection.replicaSet = replicaSet.trim();
    this.trigger(this.state);
  },

  /**
   * Changes the SSL CA.
   *
   * @param {Array} files - The files.
   */
  onSSLCAChanged(files) {
    this.state.currentConnection.sslCA = files;
    this.trigger(this.state);
  },

  /**
   * Changes the SSL certificate.
   *
   * @param {Array} files - The files.
   */
  onSSLCertificateChanged(files) {
    this.state.currentConnection.sslCert = files;
    this.trigger(this.state);
  },

  /**
   * Changes the SSL method.
   *
   * @param {String} method - The SSL method.
   */
  onSSLMethodChanged(method) {
    this._clearSSLFields();
    this.state.currentConnection.sslMethod = method;
    this.trigger(this.state);
  },

  /**
   * Changes the SSL private key.
   *
   * @param {Array} files - The files.
   */
  onSSLPrivateKeyChanged(files) {
    this.state.currentConnection.sslKey = files;
    this.trigger(this.state);
  },

  /**
   * Changes the SSL password.
   *
   * @param {String} password - The password.
   */
  onSSLPrivateKeyPasswordChanged(password) {
    this.state.currentConnection.sslPass = password;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel password.
   *
   * @param {String} password - The password.
   */
  onSSHTunnelPasswordChanged(password) {
    this.state.currentConnection.sshTunnelPassword = password;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel passphrase.
   *
   * @param {String} passphrase - The passphrase.
   */
  onSSHTunnelPassphraseChanged(passphrase) {
    this.state.currentConnection.sshTunnelPassphrase = passphrase;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel hostname.
   *
   * @param {String} hostname - The hostname.
   */
  onSSHTunnelHostnameChanged(hostname) {
    this.state.currentConnection.sshTunnelHostname = hostname;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel username.
   *
   * @param {String} username - The username.
   */
  onSSHTunnelUsernameChanged(username) {
    this.state.currentConnection.sshTunnelUsername = username;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel port.
   *
   * @param {String} port - The port.
   */
  onSSHTunnelPortChanged(port) {
    this.state.currentConnection.sshTunnelPort = port;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel identity file.
   *
   * @param {Array} files - The file.
   */
  onSSHTunnelIdentityFileChanged(files) {
    this.state.currentConnection.sshTunnelIdentityFile = files;
    this.trigger(this.state);
  },

  /**
   * Changes the SSH tunnel method.
   *
   * @param {String} tunnel - The method.
   */
  onSSHTunnelChanged(tunnel) {
    this._clearSSHTunnelFields();
    this.state.currentConnection.sshTunnel = tunnel;
    this.trigger(this.state);
  },

  /**
   * Changes the srv record flag.
   */
  onSRVRecordToggled() {
    this.state.currentConnection.isSrvRecord = !this.state.currentConnection
      .isSrvRecord;
    this.trigger(this.state);
  },

  /**
   * Changes the username.
   *
   * @param {String} username - The username.
   */
  onUsernameChanged(username) {
    this.state.currentConnection.mongodbUsername = username;
    this.trigger(this.state);
  },

  /** --- Help methods ---  */

  /**
   * Clears authentication fields.
   */
  _clearAuthFields() {
    AUTH_FIELDS.forEach((field) => {
      this.state.currentConnection[field] = undefined;
    });
  },

  /**
   * Clears ssl fields.
   */
  _clearSSLFields() {
    SSL_FIELDS.forEach((field) => {
      this.state.currentConnection[field] = undefined;
    });
  },

  /**
   * Clears SSH tunnel fields.
   */
  _clearSSHTunnelFields() {
    SSH_TUNNEL_FIELDS.forEach((field) => {
      this.state.currentConnection[field] = undefined;
    });
  },

  /**
   * Sets a syntax error message.
   *
   * @param {Object} error - Error.
   */
  _setSyntaxErrorMessage(error) {
    this.state.isValid = false;
    this.state.errorMessage = null;
    this.state.syntaxErrorMessage = error;
    this._clearConnection();
  },

  /**
   * Resets a syntax error message.
   */
  _resetSyntaxErrorMessage() {
    this.state.isValid = true;
    this.state.errorMessage = null;
    this.state.syntaxErrorMessage = null;
    this.trigger(this.state);
  },

  /**
   * Connects to the current connection. If connection is successful then a new
   * recent connection is created.
   *
   * @param {Object} connection - The current connection.
   */
  _connect(connection) {
    window.alert('connect');
    // this.dataService = new DataService(connection);
    // this.appRegistry.emit('data-service-initialized', this.dataService);
    // this.dataService.connect((error, ds) => {
    //   if (error) {
    //     this.setState({
    //       isValid: false,
    //       errorMessage: error.message,
    //       syntaxErrorMessage: null
    //     });
    //   } else {
    //     const currentConnection = this.state.currentConnection;
    //     const currentSaved = this.state.connections[currentConnection._id];

    //     this.state.isValid = true;
    //     this.state.isConnected = true;
    //     this.state.errorMessage = null;
    //     this.state.syntaxErrorMessage = null;
    //     this.state.isURIEditable = false;
    //     this.state.customUrl = this.state.currentConnection.driverUrl;

    //     currentConnection.lastUsed = new Date();

    //     if (currentSaved) {
    //       this._saveConnection(currentConnection);
    //     } else {
    //       this._saveRecent(currentConnection);
    //     }

    //     // TODO:
    //     // this.appRegistry.emit('data-service-connected', error, ds);
    //   }
    // });
  },

  /**
   * Clears the current connection.
   */
  _clearConnection() {
    const isFavorite = this.state.currentConnection.isFavorite;
    const name = this.state.currentConnection.name;
    const color = this.state.currentConnection.color;
    const connection = new Connection();

    this.state.currentConnection.set(connection.getAttributes({ props: true }));
    this.state.currentConnection.set({ isFavorite, name, color });
    this.trigger(this.state);
  },

  /**
   * Clears the form.
   */
  _clearForm() {
    this.state.isValid = true;
    this.state.isConnected = false;
    this.state.errorMessage = null;
    this.state.syntaxErrorMessage = null;
    this.state.customUrl = '';
  },

  /**
   * Set SSH tunnel attributes.
   *
   * @param {Connection} currentConnection - The current connection.
   * @param {Connection} parsedConnection - The parsed connection.
   */
  _setSshTunnelAttributes(currentConnection, parsedConnection) {
    if (parsedConnection) {
      SSH_TUNNEL_FIELDS.forEach((field) => {
        parsedConnection[field] = currentConnection[field];
      });
      parsedConnection.sshTunnel = currentConnection.sshTunnel;
    }
  },

  /**
   * Set TLS attributes.
   *
   * @param {Connection} currentConnection - The current connection.
   * @param {Connection} parsedConnection - The parsed connection.
   */
  _setTlsAttributes(currentConnection, parsedConnection) {
    if (parsedConnection) {
      SSL_FIELDS.forEach((field) => {
        parsedConnection[field] = currentConnection[field];
      });
      parsedConnection.sslMethod = currentConnection.sslMethod;
    }
  }
});

export default Store;
