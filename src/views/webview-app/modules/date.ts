/* eslint no-use-before-define: 0, camelcase:0 */
import d3 from 'd3';
import {
  assign,
  isEqual,
  range,
  min,
  max,
  sortBy,
  groupBy,
  defaults,
  map
} from 'lodash';
import $ from 'jquery';
import moment from 'moment';
import shared from './shared';
import many from './many';
import { inValueRange } from 'mongodb-query-util';

require('./d3-tip')(d3);

import { UpdateFilterMethod, UPDATE_FILTER_TYPE } from './update-filter-types';

function generateDefaults(n: any) {
  const doc: any = {};
  range(n).forEach(function (d: any) {
    doc[d] = [];
  });
  return doc;
}

function extractTimestamp(d: any) {
  // We need to get a timestamp from a string that could be an actual date, or
  // an object id.
  // So, at first try creating a bson ObjectId, and if that fails, create a new
  // date object from string.
  // TODO: this could be cleaner.
  try {
    return d.getTimestamp();
  } catch (e) {
    // error does not matter here, since we know objectid creation failed and
    // this is then a date string.
    return new Date(d);
  }
}

const minicharts_d3fns_date = (updateFilter: UpdateFilterMethod) => {
  // --- beginning chart setup ---
  let width = 400;
  let height = 100;
  let el: any;
  let lastNonShiftRangeValue: any = null;

  const upperRatio = 2.5;
  const upperMargin = 20;
  const options: any = {};
  const subcharts: any = [];

  const weekdayLabels = moment.weekdays();

  // A formatter for dates
  const format = d3.time.format.utc('%Y-%m-%d %H:%M:%S');

  const margin = shared.margin;
  const barcodeX = d3.time.scale();

  // set up tooltips
  const tip = d3.tip()
    .attr('class', 'd3-tip d3-tip-date')
    .html(function (d: any) {
      return d.label;
    })
    .direction('n')
    .offset([-9, 0]);

  const brush = d3.svg.brush()
    .x(barcodeX)
    // .on('brushstart', brushstart)
    .on('brush', brushed)
    .on('brushend', brushend);

  // function brushstart(clickedLine) {
  //   // remove selections and half selections
  //   const lines = d3.selectAll(options.view.queryAll('.selectable'));
  //   lines.classed('selected', function() {
  //     return this === clickedLine;
  //   });
  //   lines.classed('unselected', function() {
  //     return this !== clickedLine;
  //   });
  // }

  function handleDrag() {
    // const QueryAction = appRegistry.getAction('Query.Actions');
    const lines = el.selectAll('line.selectable');
    const numSelected = el.selectAll('line.selectable.selected').length;
    const s = brush.extent();

    // add `unselected` class to all elements
    lines.classed('unselected', true);
    lines.classed('selected', false);

    // get elements within the brush
    const selected = lines.filter(function (d: any) {
      return s[0] <= d.ts && d.ts <= s[1];
    });

    // add `selected` class and remove `unselected` class
    selected.classed('selected', true);
    selected.classed('unselected', false);

    if (numSelected !== selected[0].length) {
      // Number of selected items has changed, trigger querybuilder event.
      if (selected[0].length === 0) {
        updateFilter({
          field: options.fieldName
        }, UPDATE_FILTER_TYPE.CLEAR_VALUE);
        return;
      }
    }

    // TODO: These values gonna need fixing @rhys
    const minValue: any = min(selected.data()/* , function (d: any) {
      return d.ts;
    }*/);
    const maxValue: any = max(selected.data()/* , function (d: any) {
      return d.ts;
    }*/);

    if (isEqual(minValue.ts, maxValue.ts)) {
      // If values are the same, single equality query.
      updateFilter({
        field: options.fieldName,
        value: minValue.value
      }, UPDATE_FILTER_TYPE.SET_VALUE); // @rhys This used to have boolean true at the end...
      return;
    }
    // binned values, build range query with $gte and $lte
    updateFilter({
      field: options.fieldName,
      min: minValue.value,
      max: maxValue.value,
      maxInclusive: true
    }, UPDATE_FILTER_TYPE.SET_RANGE_VALUES);
    // setRangeValues(options.fieldName, minValue.value, maxValue.value, true);
  }

  function brushed() {
    handleDrag();
  }

  function brushend() {
    d3.select(this).call(brush.clear());
  }


  function handleMouseDown(d: any) {
    // const QueryAction = appRegistry.getAction('Query.Actions');
    if (d3.event.shiftKey && lastNonShiftRangeValue) {
      const minVal = d.ts < lastNonShiftRangeValue.ts ? d.value : lastNonShiftRangeValue.value;
      const maxVal = d.ts > lastNonShiftRangeValue.ts ? d.value : lastNonShiftRangeValue.value;
      updateFilter({
        field: options.fieldName,
        min: minVal,
        max: maxVal,
        maxInclusive: true
      }, UPDATE_FILTER_TYPE.SET_RANGE_VALUES);
      // setRangeValues(options.fieldName, minVal, maxVal, true);
    } else {
      // remember non-shift value so that range can be extended with shift
      lastNonShiftRangeValue = d;
      updateFilter({
        field: options.fieldName,
        value: d.value
      }, UPDATE_FILTER_TYPE.SET_VALUE);
      // setValue(options.fieldName, d.value);
    }

    // console.log('Here! Avoid jquery - this may break...');
    // const parent = document.querySelector(this).closest('.minichart');
    const parent = $(this).closest('.minichart');
    const background = parent.find('g.brush > rect.background')[0];
    const brushNode = parent.find('g.brush')[0];
    const start = barcodeX.invert(d3.mouse(background)[0]);

    const w = d3.select(window)
      .on('mousemove', mousemove)
      .on('mouseup', mouseup);

    d3.event.preventDefault(); // disable text dragging

    function mousemove() {
      const extent = [start, barcodeX.invert(d3.mouse(background)[0])];
      d3.select(brushNode).call(brush.extent(sortBy(extent)));
      brushed.call(brushNode);
    }

    function mouseup() {
      // bar.classed('selected', true);
      w.on('mousemove', null).on('mouseup', null);
      brushend.call(brushNode);
    }
  }

  function selectFromQuery(lines: any) {
    if (options.query === undefined) {
      lines.classed('unselected', false);
      lines.classed('selected', false);
      lines.classed('half', false);
      return;
    }
    lines.each(function (d: any) {
      d.inRange = inValueRange(options.query, d);
    });

    lines.classed('selected', function (d: any) {
      return d.inRange === 'yes';
    });
    lines.classed('unselected', function (d: any) {
      return d.inRange === 'no';
    });
  }


  function chart(selection: any) {
    selection.each(function (data: any) {
      const values = data.map(function (d: any) {
        const ts = extractTimestamp(d);
        return {
          label: format(ts),
          ts: ts,
          value: d,
          count: 1
        };
      });

      // without `-1` the tooltip won't always trigger on the rightmost value
      const innerWidth = width - margin.left - margin.right - 1;
      const innerHeight = height - margin.top - margin.bottom;
      el = d3.select(this);

      const barcodeTop = Math.floor(innerHeight / 2 + 15);
      const barcodeBottom = Math.floor(innerHeight - 10);

      const upperBarBottom = innerHeight / 2 - 20;

      barcodeX
        .domain(d3.extent(values, function (d: any) {
          return d.ts;
        }))
        .range([0, innerWidth]);

      // group by weekdays
      const w = groupBy(values, function (d: any) {
        return moment(d.ts).weekday();
      });
      const wd = defaults(w, generateDefaults(7));
      const weekdays = map(wd, function (d, i: number) {
        return {
          label: weekdayLabels[i],
          count: d.length
        };
      });

      // group by hours
      const hourLabels = d3.range(24);
      const h = groupBy(values, function (d: any) {
        return d.ts.getHours();
      });
      const hd = defaults(h, generateDefaults(24));
      const hours = map(hd, function (d, i: number) {
        return {
          label: hourLabels[i] + ':00',
          count: d.length
        };
      });

      el.call(tip);

      const g = el.selectAll('g').data([data]);

      // append g element if it doesn't exist yet
      const gEnter = g.enter()
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      gEnter.append('g')
        .attr('class', 'weekday')
        .append('text')
        .attr('class', 'date-icon fa-fw')
        .attr('x', 0)
        .attr('dx', '-0.6em')
        .attr('y', 0)
        .attr('dy', '1em')
        .attr('text-anchor', 'end')
        .attr('font-family', 'FontAwesome')
        .text('\uf133');

      gEnter.append('g')
        .attr('class', 'hour')
        .append('text')
        .attr('class', 'date-icon fa-fw')
        .attr('x', 0)
        .attr('dx', '-0.6em')
        .attr('y', 0)
        .attr('dy', '1em')
        .attr('text-anchor', 'end')
        .attr('font-family', 'FontAwesome')
        .text('\uf017');

      el.select('.hour')
        .attr('transform', 'translate(' + (innerWidth / (upperRatio + 1) + upperMargin) + ', 0)');

      const gBrush = g.selectAll('.brush').data([0]);
      gBrush.enter().append('g')
        .attr('class', 'brush')
        .call(brush)
        .selectAll('rect')
        .attr('y', barcodeTop)
        .attr('height', barcodeBottom - barcodeTop);

      gEnter.append('g')
        .attr('class', 'line-container');

      const lines = g.select('.line-container').selectAll('.selectable').data(values, function (d: any) {
        return d.ts;
      });

      lines.enter().append('line')
        .attr('class', 'line selectable')
        .style('opacity', function () {
          return lines.size() > 200 ? 0.3 : 1.0;
        })
        .on('mouseover', tip.show)
        .on('mouseout', tip.hide)
        .on('mousedown', handleMouseDown);

      // disabling direct onClick handler in favor of click-drag
      //   .on('click', handleClick);

      lines
        .attr('y1', barcodeTop)
        .attr('y2', barcodeBottom)
        .attr('x2', function (d: any) {
          return barcodeX(d.ts);
        })
        .attr('x1', function (d: any) {
          return barcodeX(d.ts);
        });

      lines.exit().remove();

      // unset the non-shift clicked bar marker if the query is empty
      if (options.query === undefined) {
        lastNonShiftRangeValue = null;
      }

      // paint remaining lines in correct color
      el.selectAll('line.selectable').call(selectFromQuery);

      const text = g.selectAll('.text')
        .data(barcodeX.domain());

      text.enter().append('text')
        .attr('class', 'text')
        .attr('dy', '0.75em')
        .attr('y', barcodeBottom + 5);

      text
        .attr('x', function (d: any, i: number) {
          return i * innerWidth;
        })
        .attr('text-anchor', function (d: any, i: number) {
          return i ? 'end' : 'start';
        })
        .text(function (d: any, i: number) {
          if (format(barcodeX.domain()[0]) === format(barcodeX.domain()[1])) {
            if (i === 0) {
              return 'inserted: ' + format(d);
            }
          } else {
            return (i ? 'last: ' : 'first: ') + format(d);
          }
        });

      text.exit().remove();

      let chartWidth = innerWidth / (upperRatio + 1) - upperMargin;
      const weekdayContainer = g.select('g.weekday').data([weekdays]);
      const manyDayChart = many(updateFilter)
        .width(chartWidth)
        .height(upperBarBottom)
        .options({
          selectable: false,
          bgbars: true,
          labels: {
            'text-anchor': 'middle',
            text: function (d: any) {
              // TODO @Rhys: addedV
              if (!d.label) {
                return 'no label to be found';
              }
              return d.label[0];
            }
          }
        });
      weekdayContainer.call(manyDayChart);
      subcharts.push(manyDayChart);

      chartWidth = innerWidth / (upperRatio + 1) * upperRatio - upperMargin;
      const hourContainer = g.select('g.hour').data([hours]);
      const manyHourChart = many(updateFilter)
        .width(chartWidth)
        .height(upperBarBottom)
        .options({
          selectable: false,
          bgbars: true,
          labels: {
            text: function (d: any, i: number) {
              return i % 6 === 0 || i === 23 ? d.label : '';
            }
          }
        });
      hourContainer.call(manyHourChart);
      subcharts.push(manyHourChart);
    });
  }

  chart.width = function (value: any) {
    if (!arguments.length) {
      return width;
    }
    width = value;
    return chart;
  };

  chart.height = function (value: any) {
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
    for (const subchart of subcharts) {
      subchart.cleanup();
    }
    tip.destroy();
    return chart;
  };

  return chart;
};

export default minicharts_d3fns_date;
