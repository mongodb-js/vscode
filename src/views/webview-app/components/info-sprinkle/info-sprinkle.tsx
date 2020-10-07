import * as React from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

const styles = require('./info-sprinkle.less');

type props = {
  linkTo: string;
};

class InfoSprinkle extends React.Component<props> {
  render(): React.ReactNode {
    return (
      <a
        className={classnames(styles['info-sprinkle'])}
        target="_blank"
        rel="noopener"
        href={this.props.linkTo}
      >
        <FontAwesomeIcon
          className={classnames(styles['info-sprinkle-icon'])}
          icon={faInfoCircle}
        />
      </a>
    );
  }
}

export default InfoSprinkle;
