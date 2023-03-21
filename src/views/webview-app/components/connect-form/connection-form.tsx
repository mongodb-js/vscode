import * as React from 'react';
import { connect } from 'react-redux';

import { ActionTypes, ConnectionFormChangedAction } from '../../store/actions';
import SSLMethodTab from './ssl-tab/ssl-tab';
import SSHTunnelTab from './ssh-tab/ssh-tunnel-tab';
import FormActions from '../form/form-actions';
import { AppState } from '../../store/store';
import { CONNECTION_FORM_TABS } from '../../store/constants';
import AdvancedTab from './advanced-tab/advanced-tab';
import GeneralTab from './general-tab/general-tab';
import ConnectionFormTabs from './connection-form-tabs';

import styles from './connection-form.less';

type StateProps = {
  connectionFormTab: CONNECTION_FORM_TABS;
  connectionMessage: string;
  errorMessage: string;
  isConnected: boolean;
  isConnecting: boolean;
  isValid: boolean;
  syntaxErrorMessage: string;
};

type DispatchProps = {
  onConnectionFormChanged: () => void;
};

type props = StateProps & DispatchProps;

export class ConnectionForm extends React.Component<props> {
  render(): React.ReactNode {
    const {
      connectionFormTab,
      connectionMessage,
      errorMessage,
      isConnected,
      isConnecting,
      isValid,
      onConnectionFormChanged,
      syntaxErrorMessage,
    } = this.props;

    return (
      <form
        onChange={onConnectionFormChanged}
        className={styles['connection-form']}
      >
        <h2 className={styles['connection-form-title']}>New connection</h2>
        <ConnectionFormTabs />

        <div className={styles['connection-form-fields']}>
          {connectionFormTab === CONNECTION_FORM_TABS.GENERAL && <GeneralTab />}
          {connectionFormTab === CONNECTION_FORM_TABS.SSL && <SSLMethodTab />}
          {connectionFormTab === CONNECTION_FORM_TABS.SSH && <SSHTunnelTab />}
          {connectionFormTab === CONNECTION_FORM_TABS.ADVANCED && (
            <AdvancedTab />
          )}
        </div>

        <FormActions
          connectionMessage={connectionMessage}
          errorMessage={errorMessage}
          isConnected={isConnected}
          isConnecting={isConnecting}
          isValid={isValid}
          syntaxErrorMessage={syntaxErrorMessage}
        />
      </form>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    connectionFormTab: state.connectionFormTab,
    connectionMessage: state.connectionMessage,
    errorMessage: state.errorMessage,
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isValid: state.isValid,
    syntaxErrorMessage: state.syntaxErrorMessage,
  };
};

const mapDispatchToProps: DispatchProps = {
  // Resets URL validation if form was changed.
  onConnectionFormChanged: (): ConnectionFormChangedAction => ({
    type: ActionTypes.CONNECTION_FORM_CHANGED,
  }),
};

export default connect(mapStateToProps, mapDispatchToProps)(ConnectionForm);
