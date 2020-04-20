import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import FileInputButton from '../file-input-button';
import { ActionTypes, OnChangeSSLCAAction } from '../../../store/actions';
import { AppState } from '../../../store/store';

const styles = require('../../../connect.module.less');

type stateProps = {
  isValid: boolean;
  sslCA?: string[];
};

type dispatchProps = {
  onChangeSSLCA: () => void;
};

type props = stateProps & dispatchProps;

class SSLServerValidation extends React.Component<props> {
  static displayName = 'SSLServerValidation';

  /**
   * Handles sslCA change.
   */
  onClickChangeSSLCA = (): void => {
    this.props.onChangeSSLCA();
  };

  render(): React.ReactNode {
    const { isValid, sslCA } = this.props;

    return (
      <div
        id="ssl-server-validation"
        className={classnames(styles['form-group'])}
      >
        <FileInputButton
          error={!isValid && sslCA === undefined}
          id="sslCA"
          label="Certificate Authority"
          link="https://docs.mongodb.com/manual/tutorial/configure-ssl/#certificate-authorities"
          multi
          onClick={this.onClickChangeSSLCA}
          values={this.props.sslCA}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): stateProps => {
  return {
    isValid: state.isValid,
    sslCA: state.currentConnection.sslCA
  };
};

const mapDispatchToProps: dispatchProps = {
  onChangeSSLCA: (): OnChangeSSLCAAction => ({
    type: ActionTypes.ON_CHANGE_SSL_CA
  })
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SSLServerValidation);
