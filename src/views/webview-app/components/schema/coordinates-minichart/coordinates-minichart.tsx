import React, { Component } from 'react';
import L from 'leaflet';
import { Map, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import 'leaflet-defaulticon-compatibility';
import { debounce } from 'lodash';

import './coordinates-minichart.css';

import GeoscatterMapItem from './marker';
import { DEFAULT_TILE_URL } from './constants';
import { InnerFieldType } from '../../../models/field-type';
import { getHereAttributionMessage } from './utils';

// TODO: Disable boxZoom handler for circle lasso.
//
// const SELECTED_COLOR = '#F68A1E';
const UNSELECTED_COLOR = '#43B1E5';
// const CONTROL_COLOR = '#ed271c';

/**
 * Fetches the tiles from the compass maps-proxy
 * and attaches the attribution message to the
 * map.
 * @param {react-leaflet.Map} map The rendered component ref.
 */
const attachAttribution = async function (map: any) {
  let attributionMessage = '';
  if (map) {
    const bounds = map.leafletElement.getBounds();
    const level = map.leafletElement.getZoom();

    attributionMessage = await getHereAttributionMessage(bounds, level);
  }
  return attributionMessage;
};

/**
 * @example
 * var doc = {
 *   _id: ObjectId('5c8c1f86db2e914acc6e8a17'),
 *   'Start Time': '',
 *   'End Time': null,
 *   Name: null,
 *   Latitude: null,
 *   Longitude: null,
 *   Service: null,
 *   Coordinates: [NaN, NaN]
 * };
 * isValidLatLng(doc.Coordinates) // [NaN, NaN];
 * > false
 * @param {Array<Double>} value
 * @returns {Boolean}
 */
const isValidLatLng = (value: any) => {
  if (isNaN(+value[0]) || isNaN(+value[1])) {
    // eslint-disable-next-line no-console
    console.warn('@mongodb-js/compass-schema:coordinates-minichart: Dropping invalid coordinate value', value);
    return false;
  }

  return true;
};

/**
 * Transforms an array `[lat,long]` coordinates into a GeoJSON Point.
 * @param {Array} value `[long, lat]`
 * @returns {Object}
 */
const valueToGeoPoint = (value: any) => {
  const [lat, lng] = [+value[0], +value[1]];

  const point = {
    type: 'Point',
    coordinates: [lng, lat],
    center: [lng, lat],
    color: UNSELECTED_COLOR,
    /**
     * Passed to `<CustomPopup />`
     */
    fields: [
      {
        key: '[longitude, latitude]',
        value: `[${[lng, lat].toString()}]`
      }
    ]
  };
  return point;
};

/**
 * Example `type` prop:
 *
 * ```
 * {
 *   name: 'Boolean',
 *   count: 1,
 *   probability: 0.25,
 *   unique: 1,
 *   values: [true]
 * }
 * ```
 */


type props = {
  // _id: string,
  type: InnerFieldType;
  width: number;
  height: number;
  fieldName: string;
};

// From charts geospatial map-item.
class CoordinatesMinichart extends Component<props> {
  state = {
    ready: false,
    attributionMessage: ''
  };

  componentDidUpdate() {
    this.fitMapBounds();
    this.invalidateMapSize();
  }

  onMoveEnd = debounce(() => {
    this.getTileAttribution();
  });

  onCreated = (evt: any) => {
    return;
  };

  onEdited = (evt: any) => {
    return;
  };

  onDeleted = (evt: any) => {
    return;
  };


  async getTileAttribution() {
    if (this.state.attributionMessage !== '') {
      return;
    }

    const attributionMessage = await attachAttribution(this.mapRef);
    this.setState({ attributionMessage });
  }

  /**
   * Sets a map view that contains the given geographical bounds
   * with the maximum zoom level possible.
   */
  fitMapBounds() {
    const map = this.mapRef;
    if (!map) {
      return;
    }
    const leaflet = (map).leafletElement;

    const values = this.props.type.values.filter(isValidLatLng);

    let bounds = leaflet.getBounds();// @RHYS - USED TO BE: // L.latLngBounds();

    if (values.length === 1) {
      bounds = L.latLng(+values[0][1], +values[0][0]).toBounds(800);
    } else {
      values.forEach(v => {
        bounds.extend(L.latLng(+v[1], +v[0]));
      });
    }
    // If the bounds are equal, we need to extend them otherwise leaflet will error.
    if (bounds._northEast.lat === bounds._southWest.lat &&
      bounds._northEast.lng === bounds._southWest.lng) {
      bounds._northEast.lat = bounds._northEast.lat + 0.1;
      bounds._southWest.lng = bounds._southWest.lng - 0.1;
    }
    leaflet.fitBounds(bounds);
  }

  whenMapReady = () => {
    if (this.state.ready) {
      return;
    }

    this.getTileAttribution();
    this.setState({ ready: true }, this.invalidateMapSize);
  };


  // mapRef: HTMLDivElement | null = null;
  mapRef: any = null;

  invalidateMapSize() {
    const mapRef: any = this.mapRef;
    if (!mapRef) {
      return;
    }

    mapRef.container.style.height = `${this.props.height}px`;
    mapRef.container.style.width = `${this.props.width}px`;
    mapRef.leafletElement.invalidateSize();
  }


  /**
   * Render child markers for each value in this field type.
   *
   * @returns {react.Component}
   */
  renderMapItems() {
    const {
      fieldName
    } = this.props;

    const values = this.props.type.values.filter(isValidLatLng);

    // TODO: We could highlight the points.

    const geopoints = values
      .map(value => {
        const v = valueToGeoPoint(value);
        v.fields[0].key = fieldName;
        return v;
      });

    return <GeoscatterMapItem data={geopoints} />;
  }

  /**
   * Values plotted to a leaftlet.js map with attribution
   * to our current map provider, HERE.
   * @returns {React.Component}
   */
  render() {
    const { attributionMessage } = this.state;
    return (
      <Map
        minZoom={1}
        viewport={{ center: [0, 0], zoom: 1 }}
        whenReady={this.whenMapReady}
        ref={ref => { this.mapRef = ref; }}
        onMoveend={this.onMoveEnd}
      >
        {this.renderMapItems()}
        <TileLayer url={DEFAULT_TILE_URL} attribution={attributionMessage} />
        <FeatureGroup>
          <EditControl
            position="topright"
            onEdited={this.onEdited}
            onCreated={this.onCreated}
            onDeleted={this.onDeleted}
            // TODO: WE COMMENTED VVV @Rhys
            // onMounted={this.onMounted}
            // onEditStop={this.onEditStop}
            // onDeleteStop={this.onDeleteStop}
            draw={{
              rectangle: true,
              polyline: false,
              marker: false,
              circlemarker: false
            }}
          />
        </FeatureGroup>
      </Map>
    );
  }
}

export default CoordinatesMinichart;
