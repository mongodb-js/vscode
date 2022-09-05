import * as React from 'react';

import styles from './divider.less';

export class Divider extends React.Component {
  render(): React.ReactNode {
    return <div className={styles['form-divider']} />;
  }
}

export default Divider;
