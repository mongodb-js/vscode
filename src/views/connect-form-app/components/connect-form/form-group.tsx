import React, { PureComponent, ReactNode } from 'react';
import classnames from 'classnames';

import styles from '../connect.less';

type props = {
  id: string;
  separator: boolean;
  children: ReactNode;
};

class FormGroup extends PureComponent<props> {
  static displayName = 'FormGroup';

  render(): ReactNode {
    const {
      children,
      id,
      separator
    } = this.props;

    return (
      <div
        id={id}
        className={classnames({
          [styles['form-group']]: true,
          [styles['form-group-separator']]: separator
        })}
      >
        {children}
      </div>
    );
  }
}

export default FormGroup;
