const Reflux = require('reflux');

export default Reflux.createActions({
  onAuthSourceChanged: { sync: true },
  onAuthStrategyChanged: { sync: true },
  onChangeViewClicked: { sync: true },
  onConnectionFormChanged: { sync: true },
  onConnectClicked: { sync: true },
  onCustomUrlChanged: { sync: true },
  onDisconnectClicked: { sync: true },
  onEditURICanceled: { sync: true },
  onEditURIClicked: { sync: true },
  onEditURIConfirmed: { sync: true },
  onExternalLinkClicked: { sync: true },
  onHideURIClicked: { sync: true },
  onHostnameChanged: { sync: true },
  onPasswordChanged: { sync: true },
  onPortChanged: { sync: true },
  onReadPreferenceChanged: { sync: true },
  onReplicaSetChanged: { sync: true },
  onSSLCAChanged: { sync: true },
  onSSLCertificateChanged: { sync: true },
  onSSLMethodChanged: { sync: true },
  onSSLPrivateKeyChanged: { sync: true },
  onSSLPrivateKeyPasswordChanged: { sync: true },
  onSSHTunnelPasswordChanged: { sync: true },
  onSSHTunnelPassphraseChanged: { sync: true },
  onSSHTunnelHostnameChanged: { sync: true },
  onSSHTunnelUsernameChanged: { sync: true },
  onSSHTunnelPortChanged: { sync: true },
  onSSHTunnelIdentityFileChanged: { sync: true },
  onSSHTunnelChanged: { sync: true },
  onSRVRecordToggled: { sync: true },
  onUsernameChanged: { sync: true },
  onX509UsernameChanged: { sync: true }
});
