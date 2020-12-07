/* eslint camelcase: 0 */
import d3 from 'd3';
import { assign, defer, get, isEqual } from 'lodash';
import turfDistance from 'turf-distance';
import turfPoint from 'turf-point';
import turfDestination from 'turf-destination';
import mapboxgl from 'mapbox-gl/dist/mapbox-gl.js';

import shared from './shared';
import { UpdateFilterMethod, UPDATE_FILTER_TYPE } from './update-filter-types';

const SELECTED_COLOR = '#F68A1E';
const UNSELECTED_COLOR = '#43B1E5';
const CONTROL_COLOR = '#ed271c';

const API_URL = 'https://compass-maps.mongodb.com/compass/maptile';
// If no tile server is provided, use this url instead.
// const DEFAULT_TILE_URL = API_URL + '/{z}/{x}/{y}';

// The copyright url for HERE maps, if we're using the default tile url
// const COPYRIGHT_URL = 'https://compass-maps.mongodb.com/compass/copyright';

mapboxgl.config.ACCESS_TOKEN = '12345';
mapboxgl.config.API_URL = API_URL;

const minichartsD3fnsGeo = (updateFilter: UpdateFilterMethod) => {
  // --- beginning chart setup ---
  let width = 400;
  let height = 100;
  let map: any = null;
  let mousedown = false;
  let circleControl: any;

  const options: any = {
    view: null
  };

  let circleCenter: any;
  let circleOuter: any; // control points
  let mileDistance: any;
  let circleSelected = false; // have we completed the circle?
  let svg: any;
  let render: any;
  let dots: any;

  const margin = shared.margin;

  function CircleSelector(container: any) {
    let dragging = false; // track whether we are dragging

    // we expose events on our component
    const dispatch = d3.dispatch('update', 'clear');

    // this will likely be overriden by leaflet projection
    let project: any;
    let unproject: any;

    let update: any = null;

    function dispatchQueryActions() {
      // const QueryAction = localAppRegistry.getAction('Query.Actions');

      if (circleCenter && circleOuter) {
        mileDistance = turfDistance(
          turfPoint([circleCenter.lng, circleCenter.lat]),
          turfPoint([circleOuter.lng, circleOuter.lat]),
          'miles'
        );
        // alert('TODO: Use this action to build project');
        updateFilter({
          field: options.fieldName,
          center: [circleCenter.lng, circleCenter.lat],
          radius: mileDistance / 3963.2
        }, UPDATE_FILTER_TYPE.SET_GEO_WITHIN_VALUE);
      } else {
        // alert('TODO: Use this action to clear something from the project - maybe this won\'t be a thing.');
        updateFilter({
          field: options.fieldName
        }, UPDATE_FILTER_TYPE.CLEAR_VALUE);
        // clearValue(options.fieldName);
      }
    }

    function distance(ll0: any, ll1: any) {
      const p0 = project(ll0);
      const p1 = project(ll1);
      const dist = Math.sqrt((p1.x - p0.x) * (p1.x - p0.x) + (p1.y - p0.y) * (p1.y - p0.y));
      return dist;
    }

    const drag = d3.behavior.drag()
      .on('drag', function (d: any, i: number) {
        if (circleSelected) {
          dragging = true;
          const p = d3.mouse(container.node());
          const ll = unproject([p[0], p[1]]);
          if (i) {
            circleOuter = ll;
          } else {
            const dlat = circleCenter.lat - ll.lat;
            const dlng = circleCenter.lng - ll.lng;
            circleCenter = ll;
            circleOuter.lat -= dlat;
            circleOuter.lng -= dlng;
          }
          update();
          dispatchQueryActions();
        } else {
          return;
        }
      })
      .on('dragend', function () {
        // kind of a dirty hack...
        setTimeout(function () {
          dragging = false;
          dispatchQueryActions();
        }, 100);
      });

    function clear(dontUpdate?: boolean) {
      circleCenter = null;
      circleOuter = null;
      circleSelected = false;
      container.selectAll('circle.lasso').remove();
      container.selectAll('circle.control').remove();
      container.selectAll('line.lasso').remove();
      dispatch.clear();
      if (!dontUpdate) {
        dispatchQueryActions();
      }
      return;
    }

    this.clear = clear;

    update = function (g: any) {
      if (g) {
        container = g;
      }
      if (!circleCenter || !circleOuter) return;
      const dist = distance(circleCenter, circleOuter);
      const circleLasso = container.selectAll('circle.lasso').data([dist]);
      circleLasso.enter().append('circle')
        .classed('lasso', true)
        .style({
          stroke: SELECTED_COLOR,
          'stroke-width': 2,
          fill: SELECTED_COLOR,
          'fill-opacity': 0.1
        });

      circleLasso
        .attr({
          cx: project(circleCenter).x,
          cy: project(circleCenter).y,
          r: dist
        });

      const line = container.selectAll('line.lasso').data([circleOuter]);
      line.enter().append('line')
        .classed('lasso', true)
        .style({
          stroke: CONTROL_COLOR,
          'stroke-dasharray': '2 2'
        });

      line.attr({
        x1: project(circleCenter).x,
        y1: project(circleCenter).y,
        x2: project(circleOuter).x,
        y2: project(circleOuter).y
      });

      const controls = container.selectAll('circle.control')
        .data([circleCenter, circleOuter]);
      controls.enter().append('circle')
        .classed('control', true)
        .style({
          'cursor': 'move'
        });

      controls.attr({
        cx: function (d: any) { return project(d).x; },
        cy: function (d: any) { return project(d).y; },
        r: 5,
        stroke: CONTROL_COLOR,
        fill: CONTROL_COLOR,
        'fill-opacity': 0.7
      }).call(drag)
        .on('mousedown', function () {
          map.dragPan.disable();
        })
        .on('mouseup', function () {
          map.dragPan.enable();
        });

      dispatch.update();
    }; // end update()
    this.update = update;

    function setCircle(centerLL: any, radiusMiles: any) {
      const pCenter = turfPoint([centerLL[0], centerLL[1]]);
      const pOuter = turfDestination(pCenter, radiusMiles, 45, 'miles');
      circleCenter = mapboxgl.LngLat.convert(pCenter.geometry.coordinates);
      circleOuter = mapboxgl.LngLat.convert(pOuter.geometry.coordinates);
      circleSelected = true;
      update();
    }
    this.setCircle = setCircle;

    container.on('mousedown.circle', function () {
      if (!d3.event.shiftKey) return;
      if (dragging && circleSelected) return;
      if (!dragging && circleSelected) {
        // reset and remove circle
        clear();
        return;
      }

      map.dragPan.disable();
      mousedown = true;
      const p = d3.mouse(this);
      const ll = unproject([p[0], p[1]]);

      if (!circleCenter) {
        // We set the center to the initial click
        circleCenter = ll;
        circleOuter = ll;
      }
      update();
    });

    container.on('mousemove.circle', function () {
      if (circleSelected || !circleCenter) return;
      // we draw a guideline for where the next point would go.
      const p = d3.mouse(this);
      const ll = unproject([p[0], p[1]]);
      circleOuter = ll;
      update();
      dispatchQueryActions();
    });

    container.on('mouseup.circle', function () {
      mousedown = false;
      if (dragging && circleSelected) return;

      map.dragPan.enable();

      const p = d3.mouse(this);
      const ll = unproject([p[0], p[1]]);

      if (circleCenter) {
        if (!circleSelected) {
          circleOuter = ll;
          circleSelected = true;
          dispatchQueryActions();
        }
      }
    });

    this.projection = function (val: any) {
      if (!val) return project;
      project = val;
      return this;
    };

    this.inverseProjection = function (val: any) {
      if (!val) return unproject;
      unproject = val;
      return this;
    };

    this.distance = function (ll: any) {
      if (!ll) ll = circleOuter;
      return distance(circleCenter, ll);
    };

    d3.rebind(this, dispatch, 'on');
    return this;
  }

  function selectFromQuery() {
    // don't update from query while dragging the circle
    if (mousedown) {
      return;
    }
    if (options.query === undefined) {
      circleControl.clear(true);
      return;
    }
    const center = get(options.query, '$geoWithin.$centerSphere[0]');
    const radius = get(options.query, '$geoWithin.$centerSphere[1]', 0) * 3963.2;
    if (!center || !radius) {
      circleControl.clear(true);
      return;
    }
    // only redraw if the center/radius is different to the existing circle
    if (radius !== mileDistance || !isEqual(center, [circleCenter.lng, circleCenter.lat])) {
      circleControl.setCircle(center, radius);
    }
  }
  // --- end chart setup ---

  function chart(selection: any) {
    selection.each(function (data: any) {
      function getLL(d: any) {
        if (d instanceof mapboxgl.LngLat) return d;
        return new mapboxgl.LngLat(+d[0], +d[1]);
      }
      function project(d: any) {
        return map.project(getLL(d));
      }

      const el = d3.select(this);
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // append inner div once
      const innerDiv = el.selectAll('div.map').data([null]);
      innerDiv.enter().append('div')
        .attr('class', 'map');

      innerDiv
        .style({
          width: innerWidth + 'px',
          height: innerHeight + 'px',
          padding: margin.top + 'px ' + margin.right + 'px ' + margin.bottom
            + 'px ' + margin.left + 'px;'
        });

      // Add maps help overlay of how to $geoWithin
      const mapoverlay = el.selectAll('div.map-overlay').data([null]).enter()
        .append('div')
        .classed('map-overlay', true);
      mapoverlay
        .append('div')
        .html('shift')
        .classed('map-overlay-button', true);
      mapoverlay
        .append('p')
        .html('+ Drag to Build a Query')
        .classed('map-overlay-text', true);

      // compute bounds from data
      const bounds = new mapboxgl.LngLatBounds();
      data.forEach(function (d: any) {
        bounds.extend(getLL(d));
      });

      // create the map once
      if (!map) {
        map = new mapboxgl.Map({
          container: innerDiv[0][0],
          // not allowed to whitelabel the map ever due to OpenStreetMaps license.
          // attributionControl: false,
          style: 'mapbox://openmaptiles.4qljc88t',
          center: bounds.getCenter()
        });
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.boxZoom.disable();

        // Add zoom and rotation controls to the map
        const navControl = new mapboxgl.NavigationControl();
        map.addControl(navControl, 'top-left');

        // Setup our svg layer that we can manipulate with d3
        const container = map.getCanvasContainer();
        svg = d3.select(container).append('svg');

        circleControl = new (CircleSelector as any)(svg)
          .projection(project)
          .inverseProjection(function (a: any) {
            return map.unproject({ x: a[0], y: a[1] });
          });

        // when lasso changes, update point selections
        circleControl.on('update', function () {
          svg.selectAll('circle.dot').style({
            fill: function (d: any) {
              const thisDist = circleControl.distance(d);
              const circleDist = circleControl.distance();
              if (thisDist < circleDist) {
                return SELECTED_COLOR;
              }
              return UNSELECTED_COLOR;
            }
          });
        });
        circleControl.on('clear', function () {
          svg.selectAll('circle.dot').style('fill', UNSELECTED_COLOR);
        });

        /* eslint no-inner-declarations: 0 */
        render = function () {
          // update points
          dots.attr({
            cx: function (d: any) {
              const x = project(d).x;
              return x;
            },
            cy: function (d: any) {
              const y = project(d).y;
              return y;
            }
          });
          // update circle
          circleControl.update(svg);
        };

        // re-render our visualization whenever the view changes
        map.on('viewreset', function () {
          render();
        });
        map.on('move', function () {
          render();
        });

        defer(function () {
          map.resize();
          map.fitBounds(bounds, {
            linear: true,
            padding: 20
          });
        });
      } // end if (!map) ...

      // draw data points
      dots = svg.selectAll('circle.dot')
        .data(data);
      dots.enter().append('circle').classed('dot', true)
        .attr('r', 4)
        .style({
          fill: UNSELECTED_COLOR,
          stroke: 'white',
          'stroke-opacity': 0.6,
          'stroke-width': 1
        });

      selectFromQuery();
      render();
    }); // end selection.each()
  }

  chart.width = function (value: number) {
    if (!arguments.length) {
      return width;
    }
    width = value;
    return chart;
  };

  chart.height = function (value: number) {
    if (!arguments.length) {
      return height;
    }
    height = value;
    return chart;
  };

  chart.options = function (value: any) {
    if (!arguments.length) {
      return options;
    }
    assign(options, value);
    return chart;
  };

  chart.geoSelection = function (value: any) {
    if (!value) {
      circleControl.clear();
      return;
    }
    circleControl.setCircle(value[0], value[1]);
  };

  chart.cleanup = function () {
    return chart;
  };

  return chart;
};

export default minichartsD3fnsGeo;
