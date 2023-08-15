import classnames from 'classnames';
import * as React from 'react';
import { connect } from 'react-redux';

import FileInputButton from '../../form/file-input-button';
import type { OnChangeSSLCAAction } from '../../../store/actions';
import { ActionTypes } from '../../../store/actions';
import type { AppState } from '../../../store/store';

import styles from '../../../connect.module.less';
import LINKS from '../../../../../utils/links';

type StateProps = {
  isValid: boolean;
  sslCA?: string[];
};

type DispatchProps = {
  onChangeSSLCA: () => void;
};

type props = StateProps & DispatchProps;

class SSLServerValidation extends React.Component<props> {
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
          link={LINKS.configureSSLDocs('#certificate-authorities')}
          multi
          onClick={this.onClickChangeSSLCA}
          values={this.props.sslCA}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: AppState): StateProps => {
  return {
    isValid: state.isValid,
    sslCA: state.currentConnection.sslCA,
  };
};

const mapDispatchToProps: DispatchProps = {
  onChangeSSLCA: (): OnChangeSSLCAAction => ({
    type: ActionTypes.ON_CHANGE_SSL_CA,
  }),
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SSLServerValidation);
