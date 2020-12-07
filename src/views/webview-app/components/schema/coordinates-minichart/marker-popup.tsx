import React, { Component } from 'react';
import { Popup } from 'react-leaflet';

import styles from './marker-popup.less';

type CustomPopupProps = {
  fields: any[];
};

class CustomPopup extends Component<CustomPopupProps> {
  render() {
    const { fields } = this.props;

    return (
      <Popup
        // TODO(@Rhys): Removed these props - do we need?
        // closeButton={false}
        // className={styles.popup}
      >
        <CustomPopupFields fields={fields} />
      </Popup>
    );
  }
}

// eslint-disable-next-line react/no-multi-comp
class CustomPopupFields extends Component<CustomPopupProps> {
  render() {
    const { fields } = this.props;

    return fields
      .filter((field: any) => field.key)
      .map((field: any) => {
        const { key, value } = field;

        return (
          <span className={styles.line} key={key}>
            <span className={styles.key}>{key}:</span>{' '}
            <span className={styles.value}>{value}</span>
          </span>
        );
      });
  }
}

export default CustomPopup;
export { CustomPopup, CustomPopupFields };
