/* eslint camelcase: 0 */
import d3 from 'd3';
import {
  assign,
  has,
  includes,
  groupBy,
  sortBy,
  map
} from 'lodash';
import many from './many';
import shared from './shared';

import { UpdateFilterMethod } from './update-filter-types';

/**
* extracts a Javascript number from a BSON type.
*
* @param {Any} value     value to be converted to a number
* @return {Number}       converted value
*/
function extractNumericValueFromBSON(value: any) {
  if (has(value, '_bsontype')) {
    if (includes(['Decimal128', 'Long'], value._bsontype)) {
      return parseFloat(value.toString());
    }
    if (includes(['Double', 'Int32'], value._bsontype)) {
      return value.value;
    }
  }
  // unknown value, leave as is.
  return value;
}

const minichartsD3fnsNumber = (updateFilter: UpdateFilterMethod) => {
  let width = 400;
  let height = 100;
  const options: any = {
    view: null
  };
  const margin = shared.margin;
  const xBinning = d3.scale.linear();
  const manyChart = many(updateFilter);

  function chart(selection: any) {
    selection.each(function (data: any) {
      let grouped;
      const el = d3.select(this);
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // transform data
      if (options.unique < 20) {
        const g = groupBy(data, function (d) {
          return extractNumericValueFromBSON(d);
        });
        const gr = map(g, function (v: any, k) {
          v.label = k;
          v.x = parseFloat(k);
          v.value = v.x;
          v.dx = 0;
          v.count = v.length;
          v.bson = v[0];
          return v;
        });
        grouped = sortBy(gr, function (v) {
          return v.value;
        });
      } else {
        // use the linear scale just to get nice binning values
        xBinning
          .domain(d3.extent(data))
          .range([0, innerWidth]);

        // Generate a histogram using approx. twenty uniformly-spaced bins
        const ticks = xBinning.ticks(20);
        const hist = d3.layout.histogram()
          .bins(ticks)
          .value(extractNumericValueFromBSON);

        grouped = hist(data);

        grouped.forEach(function (d: any, i: number) {
          let label;
          if (i === 0) {
            label = '< ' + (d.x + d.dx);
          } else if (i === data.length - 1) {
            label = '&ge; ' + d.x;
          } else {
            label = d.x + '-' + (d.x + d.dx);
          }
          // remapping keys to conform with all other types
          d.count = d.y;
          d.value = d.x;
          d.label = label;
        });
      }

      const g = el.selectAll('g').data([grouped]);

      // append g element if it doesn't exist yet
      g.enter()
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      let labels;
      if (options.unique < 20) {
        labels = true;
      } else {
        labels = {
          text: function (d: any, i: number) {
            if (i === 0) {
              return 'min: ' + d3.min(data);
            }
            if (i === grouped.length - 1) {
              return 'max: ' + d3.max(data);
            }
            return '';
          }
        };
      }

      options.labels = labels;
      options.scale = true;
      options.selectionType = 'range';

      manyChart
        .width(innerWidth)
        .height(innerHeight - 10)
        .options(options);

      g.call(manyChart);
    });
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

  chart.cleanup = function () {
    manyChart.cleanup();
    return chart;
  };

  return chart;
};

export default minichartsD3fnsNumber;
