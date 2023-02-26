import type { OutputItem } from 'vscode-notebook-renderer';

export class OutputParser {
  constructor(private outputData: OutputItem, private mimeType: string) {}

  /**
   * Gets data output.
   */
  getData(): any {
    // Try getting JSON data first.
    const objectData = this.getJsonData(this.outputData);
    if (objectData !== undefined) {
      if (objectData.features) {
        return this.flattenGeoData(objectData);
      }
      return objectData;
    }

    // Try parsing text data.
    const textData: string = this.outputData.text();
    if (textData.length > 0) {
      // See if text data is in JSON data format.
      const jsonData = this.getJsonData(textData);
      if (jsonData !== undefined) {
        if (jsonData.features) {
          return this.flattenGeoData(jsonData);
        }
        return jsonData;
      } else if (textData !== '{}' && !textData.startsWith('<Buffer ')) {
        // Empty object or binary data.
        return textData;
      }
    }

    return this.outputData;
  }

  /**
   * Gets JSON data.
   */
  getJsonData(data: any): any {
    try {
      if (typeof data === 'string') {
        // Try parsing JSON string.
        const textData: string = this.patchJson(data);
        let objectData: any = JSON.parse(textData);

        if (objectData.data) {
          // Use data object from REST response.
          objectData = objectData.data;
        }

        if (Array.isArray(objectData)) {
          return objectData;
        }

        return objectData;
      }

      // Try getting JSON data object.
      let jsonData: any = data.json();
      if (jsonData.data) {
        // Use data object from REST response.
        jsonData = jsonData.data;
      }

      if (Array.isArray(jsonData)) {
        return jsonData;
      }
    } catch (error: any) {
      console.log('OUTPUT PARSER:', error.message);
    }

    return undefined;
  }

  /**
   * Patches garbled JSON string.
   */
  patchJson(data: string): string {
    // Patch garbled JSON string.
    const escapedQuoteRegEx = /\\\\"/g;
    const objectStartRegEx = /"{/g;
    const objectEndRegEx = /}"/g;
    const xRegEx = /\\xa0/g;
    const newLineRegEx = /\\n/g;
    let textData: string = data.replace(escapedQuoteRegEx, '"');

    textData = textData.replace(objectStartRegEx, '{');
    textData = textData.replace(objectEndRegEx, '}');
    textData = textData.replace(xRegEx, ' ');
    textData = textData.replace(newLineRegEx, '');

    if (textData.startsWith("'") && textData.endsWith("'")) {
      // Strip out start/end single quotes from notebook cell output.
      textData = textData.substr(1, textData.length - 2);
    }

    return textData;
  }

  /**
   * Flattens geo data for tabular data display.
   */
  flattenGeoData(data: any): any {
    if (data.features) {
      const features = data.features.map((feature: any) => {
        const { geometry, properties, ...restOfKeys } = feature;

        const newGeometry = {} as Record<string, any>;
        Object.keys(geometry).forEach((key) => {
          newGeometry[`geometry.${key}`] = geometry[key];
        });

        const newProperties = {} as Record<string, any>;
        Object.keys(properties).forEach((key) => {
          newProperties[`${key}`] = properties[key];
        });

        return { ...restOfKeys, ...newProperties, ...newGeometry };
      });
      return features;
    }
    return data;
  }
}
