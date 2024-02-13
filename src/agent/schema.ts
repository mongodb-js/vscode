import type {
  SimplifiedSchema,
  SimplifiedSchemaArrayType,
  SimplifiedSchemaDocumentType,
  SimplifiedSchemaType,
} from 'mongodb-schema';
// import { getSimplifiedSchema } from 'mongodb-schema';

const PROPERTY_REGEX = '^[a-zA-Z_$][0-9a-zA-Z_$]*$';

export class SchemaFormatter {
  // static getSchemaFromTypes(pInput: {
  //   [name: string]: Object
  // }): string {
  static getSchemaFromTypes(pInput: SimplifiedSchema): string {
    return new SchemaFormatter().format(pInput);
  }

  // ObjectMapper _mapper;
  schemaString = '';

  constructor() {
    // this.schemaString = new StringBuilder();
    // this._mapper = new ObjectMapper();
  }
  // {
  //   [name: string]: Object
  // }
  format(pInitial: SimplifiedSchema): string {
    // const initialPrefix = '';
    this.processDocumentType('', pInitial);
    return this.schemaString;
  }

  private processSchemaTypeList(
    prefix: string,
    pTypes: SimplifiedSchemaType[]
  ) {
    // const types: {
    //   [name: string]: Object
    // }[] = pTypes; // final List<Map<String, Object>>
    // const types: {
    //   [name: string]: Object
    // }[] = pTypes; // final List<Map<String, Object>>

    if (pTypes.length !== 0) {
      this.processSchemaType(prefix, pTypes[0]);
    }
  }

  private processSchemaType(prefix: string, pType: SimplifiedSchemaType) {
    // final Map<String, Object> typeMap;
    // try {
    //   typeMap = (Map<String, Object>) pType;
    // } catch (e) {
    //   throw new Error(
    //       "processSchemaType: received a schema of unexpected type: " + (e as Error)?.message);
    // }

    const bsonType = pType.bsonType;
    if (bsonType === 'Document') {
      const fields = (pType as SimplifiedSchemaDocumentType).fields;
      // const fields = (Map<String, Object>) pType.fields;

      if (Object.keys(fields).length === 0) {
        this.addToFormattedSchemaString(prefix + ': Document');
        return;
      }

      this.processDocumentType(prefix, fields);
      return;
    }

    if (bsonType === 'Array') {
      // const types = (List<Map<String, Object>>) pType.types;
      const types = (pType as SimplifiedSchemaArrayType).types;

      if (types.length === 0) {
        this.addToFormattedSchemaString(prefix + ': ' + 'Array');
        return;
      }

      const firstType = types[0].bsonType;
      if (firstType !== 'Array' && firstType !== 'Document') {
        this.addToFormattedSchemaString(
          prefix + ': ' + 'Array<' + firstType + '>'
        );
        return;
      }

      // Array of documents or arrays.
      // We only use the first type.
      this.processSchemaType(prefix + '[]', types[0]);
      return;
    }

    this.addToFormattedSchemaString(prefix + ': ' + bsonType);
  }

  private processDocumentType(
    prefix: string,
    pDoc: SimplifiedSchema
    //   {
    //   // final Map<String, Object>
    //   [a: string]: Object
    // }
  ) {
    if (!pDoc) {
      return;
    }

    // const documentMap: {
    //   // final Map<String, Object>
    //   [a: string]: Object
    // } = pDoc;

    // try {
    //   documentMap = (Map<String, Object>) pDoc;
    // } catch (e) {
    //   throw new Error(
    //       "processDocumentType: received a document of unexpected type: " + (e as Error)?.message);
    // }

    Object.keys(pDoc).forEach((key) => {
      const keyAsString = this.getPropAsString(key);
      this.processSchemaTypeList(
        prefix + (prefix.length === 0 ? '' : '.') + keyAsString,
        pDoc[key]?.types
      );
    });
  }

  getPropAsString(pProp: string): string {
    if (pProp.match(PROPERTY_REGEX)) {
      // TODO: this if
      return pProp;
    }

    try {
      // return this._mapper.writeValueAsString(pProp);
      // JSON.stringify?
      return JSON.stringify(pProp);
    } catch (e) {
      return pProp;
    }
  }

  addToFormattedSchemaString(fieldAndType: string) {
    if (this.schemaString.length > 0) {
      this.schemaString += '\n';
    }
    this.schemaString += fieldAndType;
  }
}

// async function testSchema() {
//   console.log('test schema...');
//   const schema = await getSimplifiedSchema([{
//     name: 'test',
//     a: 33,
//     c: {
//       d: 55
//     },
//     eee: ['nice']
//   }]);
//   console.log('prompt test:', SchemaFormatter.getSchemaFromTypes(schema));
// }
// void testSchema();
