// const mockValues = [
//   { id: 1, name: "flare" },
//   { id: 2, name: "analytics", parent: 1 },
//   { id: 3, name: "cluster", parent: 2 },
//   { id: 4, name: "AgglomerativeCluster", parent: 3, size: 3938 },
//   { id: 5, name: "CommunityStructure", parent: 3, size: 3812 },
//   { id: 6, name: "HierarchicalCluster", parent: 3, size: 6714 }
// ];

export const createVegaSunburstJson = (databaseInfo: any) => {
  return {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "width": 600,
    "height": 600,
    "padding": 5,
    "autosize": "none",

    "data": [
      {
        "name": "tree",
        "values": databaseInfo,

        "transform": [
          {
            "type": "stratify",
            "key": "id",
            "parentKey": "parent"
          },
          {
            "type": "partition",
            "field": "size",
            "sort": { "field": "value" },
            "size": [{ "signal": "2 * PI" }, { "signal": "width / 2" }],
            "as": ["a0", "r0", "a1", "r1", "depth", "children"]
          }
        ]
      }
    ],

    "scales": [
      {
        "name": "color",
        "type": "ordinal",
        "domain": { "data": "tree", "field": "depth" },
        "range": { "scheme": "tableau20" }
      }
    ],

    "marks": [
      {
        "type": "arc",
        "from": { "data": "tree" },
        "encode": {
          "enter": {
            "x": { "signal": "width / 2" },
            "y": { "signal": "height / 2" },
            "fill": { "scale": "color", "field": "depth" },
            "tooltip": { "signal": "datum.name + (datum.displaySize ? ', ' + datum.displaySize + ' bytes' : '')" }
          },
          "update": {
            "startAngle": { "field": "a0" },
            "endAngle": { "field": "a1" },
            "innerRadius": { "field": "r0" },
            "outerRadius": { "field": "r1" },
            "stroke": { "value": "white" },
            "strokeWidth": { "value": 0.5 },
            "zindex": { "value": 0 }
          },
          "hover": {
            "stroke": { "value": "red" },
            "strokeWidth": { "value": 2 },
            "zindex": { "value": 1 }
          }
        }
      }
    ]
  };
};
