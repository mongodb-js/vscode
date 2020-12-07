import React, { Component } from 'react';
import { CircleMarker } from 'react-leaflet';

import MarkerPopup from './marker-popup';

const DEFAULT_STYLES = {
  weight: 1,
  radius: 5,
  fillOpacity: 0.6
};

// type PopupComponentProps = {
//   fields: any[]
// };

type MarkerProps = {
  data: any[];
};

class Marker extends Component<MarkerProps> {
  render() {
    // TODO: @RHYS Maybe need to pull data out of props.
    const {
      data
    } = this.props;

    return data.map((point: any, i: number) => {
      point.key = i;

      // Give a popup to a react-leaflet marker component
      // e.g a CircleMarker, Polygon, Polyline, Rectangle
      return (
        <CircleMarker
          {...point}
          {...DEFAULT_STYLES}
          onMouseOver={(e: any) => {
            e.target.openPopup();
          }}
          onMouseOut={(e: any) => {
            e.target.closePopup();
          }}
        >
          <MarkerPopup
            fields={point.fields}
            {...DEFAULT_STYLES}
          />
        </CircleMarker>
      );
    });
  }
}

export default Marker;
export { Marker };
