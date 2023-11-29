import * as React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import styles from './info-sprinkle.less';

type props = {
  linkTo: string;
};

class InfoSprinkle extends React.Component<props> {
  render(): React.ReactNode {
    return (
      <a
        className={styles['info-sprinkle']}
        target="_blank"
        rel="noopener"
        href={this.props.linkTo}
      >
        <FontAwesomeIcon
          className={styles['info-sprinkle-icon']}
          icon={faInfoCircle}
        />
      </a>
    );
  }
}

export default InfoSprinkle;
