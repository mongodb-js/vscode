import * as React from 'react';
// import Switch from 'react-ios-switch';
import classnames from 'classnames';

import Actions from '../../../store/actions';

const styles = require('../../../connect.module.less');

type props = {
  isSrvRecord: boolean;
};

class SRVInput extends React.PureComponent<props> {
  static displayName = 'SRVInput';

  /**
   * Handles SRV record toggle.
   *
   * @param {Object} evt - evt.
   */
  onSRVRecordToggled = (): void => {
    Actions.onSRVRecordToggled();
  };

  render(): React.ReactNode {
    const {
      isSrvRecord
    } = this.props;

    return (
      <div className={classnames(styles['form-item'])}>
        <label><span>SRV Record</span></label>
        <div className={classnames(styles['form-item-switch-wrapper'])}>
          <input
            className={classnames(styles['form-control-switch'])}
            name="isSrvRecord"
            type="checkbox"
            checked={isSrvRecord}
            onChange={this.onSRVRecordToggled}
          />
          {/* <Switch
            checked={isSrvRecord}
            onChange={this.onSRVRecordToggled.bind(this)}
            className={classnames(styles['form-control-switch'])}
            onColor="rgb(19, 170, 82)"
            style={{ backgroundColor: 'rgb(255,255,255)' }}
          /> */}
        </div>
      </div>
    );
  }
}

export default SRVInput;
