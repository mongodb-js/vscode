import * as React from 'react';
import classnames from 'classnames';

const styles = require('./form.less');

type props = {
  id: string;
  separator?: boolean;
  children?: React.ReactNode;
};

class FormGroup extends React.PureComponent<props> {
  render(): React.ReactNode {
    const { children, id, separator } = this.props;

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
