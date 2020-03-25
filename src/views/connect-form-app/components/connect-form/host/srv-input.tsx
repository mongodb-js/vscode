import React, { PureComponent, ReactNode } from 'react';

import Actions from '../../../store/actions';
import Switch from 'react-ios-switch';
import classnames from 'classnames';

import styles from '../connect.less';

type props = {
  isSrvRecord: boolean;
};

class SRVInput extends PureComponent<props> {
  static displayName = 'SRVInput';

  /**
   * Handles SRV record toggle.
   *
   * @param {Object} evt - evt.
   */
  onSRVRecordToggled(): void {
    Actions.onSRVRecordToggled();
  }

  render(): ReactNode {
    const {
      isSrvRecord
    } = this.props;

    return (
      <div className={classnames(styles['form-item'])}>
        <label><span>SRV Record</span></label>
        <div className={classnames(styles['form-item-switch-wrapper'])}>
          <Switch
            checked={isSrvRecord}
            onChange={this.onSRVRecordToggled.bind(this)}
            className={classnames(styles['form-control-switch'])}
            onColor="rgb(19, 170, 82)"
            style={{ backgroundColor: 'rgb(255,255,255)' }}
          />
        </div>
      </div>
    );
  }
}

export default SRVInput;
