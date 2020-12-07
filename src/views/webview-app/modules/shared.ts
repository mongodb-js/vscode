/* eslint camelcase: 0 */
import { format as d3Format } from 'd3';

// source: http://bit.ly/1Tc9Tp5
function decimalPlaces(number: any) {
  return ((+number).toFixed(20)).replace(/^-?\d*\.?|0+$/g, '').length;
}

const d3Round = (x: number, n: number) => n ? Math.round(x * (n = Math.pow(10, n))) / n : Math.round(x);

const minichartsD3fnsShared = {
  margin: {
    top: 10,
    right: 0,
    bottom: 10,
    left: 40
  },

  friendlyPercentFormat: function (vmax: any) {
    const prec1Format = d3Format('.1r');
    const intFormat = d3Format('.0f');
    const format = vmax > 1 ? intFormat : prec1Format;
    const maxFormatted = Number(format(vmax));
    const maxDecimals = decimalPlaces(maxFormatted);

    return function (v: any, incPrec?: any) {
      if (v === vmax) {
        return maxFormatted + '%';
      }
      if (v > 1 && !incPrec) { // v > vmax || maxFormatted % 2 === 0
        return d3Round(v, maxDecimals) + '%';
      }
      // adjust for corrections, if increased precision required
      return d3Round(v / vmax * maxFormatted, maxDecimals + 1) + '%';
    };
  },

  truncateTooltip: function (text: string, maxLength: number) {
    maxLength = maxLength || 500;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 1) + '&hellip;';
    }
    return text;
  },

  tooltip: function (label: any, count: any) {
    return `
      <div class="tooltip-wrapper">
        <div class="tooltip-label">${label}</div>
      <div class=".tooltip-value">${count}</div>
      </div>`;
  }
};

export default minichartsD3fnsShared;
