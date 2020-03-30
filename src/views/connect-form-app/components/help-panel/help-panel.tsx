import * as React from 'react';
import classnames from 'classnames';

const styles = require('../../connect.module.less');

class HelpPanel extends React.PureComponent {
  render(): React.ReactNode {
    return (
      <div className={styles['help-panel']}>
        <div className={styles['help-section']}>
          <strong>
            New to MongoDB and don't have a cluster?
          </strong>
        </div>
        <div className={styles['help-section']}>
          If you don't already have a cluster you can create one for free using
          <a
            className={styles['help-link']}
            target="_blank"
            rel="noopener"
            href="https://cloud.mongodb.com/"
          >MongoDB Atlas</a>
        </div>
        <div className={styles['help-section']}>
          <div>
            <a
              className={classnames(styles.btn, styles['btn-sm'])}
              target="_blank"
              rel="noopener"
              href="https://cloud.mongodb.com/"
            >Create Free Cluster</a>
          </div>
        </div>
      </div>
    );
  }
}

export default HelpPanel;
