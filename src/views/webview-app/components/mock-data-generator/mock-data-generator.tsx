import * as React from 'react';
import { faker } from '@faker-js/faker';
import { connect } from 'react-redux';
import { MongoDBLogo as LeafyGreenMongoDBLogo } from '@leafygreen-ui/logo';
import type { InsertMockDataAction, OpenMockDataGeneratorAction, SendAiPromptAction } from '../../store/actions';
import { ActionTypes } from '../../store/actions';
import type {
  MESSAGE_FROM_EXTENSION_TO_WEBVIEW,
} from '../../extension-app-message-constants';
import { MESSAGE_TYPES } from '../../extension-app-message-constants';

type DispatchProps = {
  toggleOpenMockDataGenerator: (database: string,
    collections: any) => void;
  insertMockData: (codeToExecute) => void;
  queryOpenAI: (prompt) => void;
};

type State = {
  fields: Array<{ name: string; type: string }>;
  mockData: Array<{ [key: string]: any }>;
  numberOfRows: number;
  selectedCollection: string;
  database: string;
  collection: string;
  aiVisible: boolean;
  aiPrompt: string;
};

export class MockDataGenerator extends React.PureComponent<DispatchProps, State> {
  componentDidMount(): void {
    window.addEventListener('message', this.handleMessageFromExtension);
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.handleMessageFromExtension);
  }

  handleMessageFromExtension = (event) => {
    const message: MESSAGE_FROM_EXTENSION_TO_WEBVIEW = event.data;

    switch (message.command) {
      case MESSAGE_TYPES.RECIEVE_AI_RESPONSE:
        console.log(message.respnse);
        this.setState({ fields: message.respnse });

        return;
      default:
        // No-op.
        return;
    }
  };

  fieldsContainerRef: React.RefObject<HTMLDivElement>;
  state: State = {
    fields: [{ name: '', type: 'string' }],
    mockData: [],
    numberOfRows: 1,
    selectedCollection: '',
    database: '',
    collection: '',
    aiVisible: false,
    aiPrompt: ''
  };
  constructor(props) {
    super(props);
    this.fieldsContainerRef = React.createRef();
  }

  addField = () => {
    this.setState(prevState => ({
      fields: [...prevState.fields, { name: '', type: 'string' }],
    }), () => {
      if (this.fieldsContainerRef.current) {
        this.fieldsContainerRef.current.scrollTop = this.fieldsContainerRef.current.scrollHeight;
      }
    });
  };

  insertData = () => {
    const mockDataString = JSON.stringify(this.state.mockData);
    if (this.state.collection !== '' && this.state.database !== '') {
      const codeToEvaluate = `use('${this.state.database}'); db.${this.state.collection}.insertMany(${mockDataString}, {ordered: false});`;
      this.props.insertMockData(codeToEvaluate);
    }
  };

  queryOpenAIFunc = () => {
      this.props.queryOpenAI(this.state.aiPrompt);
  };

  generateData = () => {
    const { fields, numberOfRows } = this.state;
    const allMockData: Array<{ [key: string]: any }> = [];
    for (let i = 0; i < numberOfRows; i++) {
      const mockData: { [key: string]: any } = {};
      // eslint-disable-next-line complexity
      fields.forEach(field => {
        const { name, type } = field;
        switch (type) {
          case 'productName':
            mockData[name] = faker.commerce.productName();
            break;
          case 'price':
            mockData[name] = faker.commerce.price();
            break;
          case 'dateOfSale':
            mockData[name] = faker.date.recent();
            break;
          case 'customerName':
            mockData[name] = faker.person.fullName();
            break;
          case 'quantity':
            mockData[name] = faker.number.int({ min: 1, max: 100 });
            break;
          case 'firstName':
            mockData[name] = faker.name.firstName();
            break;
          case 'lastName':
            mockData[name] = faker.name.lastName();
            break;
          case 'email':
            mockData[name] = faker.internet.email();
            break;
          case 'username':
            mockData[name] = faker.internet.userName();
            break;
          case 'address':
            mockData[name] = faker.location.streetAddress();
            break;
          case 'phone':
            mockData[name] = faker.phone.number();
            break;
          case 'registrationDate':
            mockData[name] = faker.date.past();
            break;
          case 'blogTitle':
            mockData[name] = faker.lorem.sentence();
            break;
          case 'blogContent':
            mockData[name] = faker.lorem.paragraphs();
            break;
          case 'authorName':
            mockData[name] = faker.person.fullName();
            break;
          case 'publishDate':
            mockData[name] = faker.date.past();
            break;
          case 'views':
            mockData[name] = faker.number.int({ min: 0, max: 5000 });
            break;
          default:
            mockData[name] = 'Invalid Type';
        }
      });
      allMockData.push(mockData);
    }
    this.setState({ mockData: allMockData });
  };
  handleChangeFieldName(index: number, value: string): void {
    this.setState(prevState => {
      const fields = [...prevState.fields];
      fields[index].name = value;
      return { fields };
    });
  }
  handleChangeFieldType(index: number, value: string): void {
    this.setState(prevState => {
      const fields = [...prevState.fields];
      fields[index].type = value;
      return { fields };
    });
  }


  render(): React.ReactNode {
    return (
      <React.Fragment>
<style>
    {`
input, select, button {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.3s;
}

hr {
  width: 100%;
  color: #211f1f;
  border: 0.3px solid #3d3838;
}

input:focus, select:focus, button:focus {
  border-color: #4CAF50; /* MongoDB green shade */
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  appearance: none;
}

button {
  background-color: #4CAF50;
  color: #fff;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-top: auto;
}

button:hover {
  background-color: #45a049;
}

#mockDataForm {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 800px;
  padding: 20px;
  width: 600px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.field-container {
  display: flex;
  gap: 20px;
  align-items: center;
  width: 100%;
}
.selector-db-col {
  display: flex;
  gap: 20px;
  width: 100%;
  align-items: center;
  flex-direction: column;
  align-items: flex-start;
}

.data-section {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}

.insert-button {
  align-self: flex-end;
  display: none;
  margin-top: 10px;
}
h3 {
  margin-bottom: 0px;
}

.data-section.data-generated .insert-button {
  display: inline-block;
}

label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

pre {
  color: #cff3a9;
  font-family: 'Courier New', Courier, monospace;
  overflow-y: auto;
  height: 200px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%;
}
.divider {
  display: flex;
  width: 100%;
}
.control {
  display: flex;
  gap: 20px;
}
.column-flex {
  flex-direction: column;
  align-items: flex-start;
}
.data-types {
  max-height: 212px;
  overflow: scroll;
}
.add-field {
  background-color: #cc8c8c;
}
.ai-conf {
  background-color: #d46d6d;
}
.mdb-logo-container {
  width: 100px;
}
h2 {
  margin-top:0px;
}
.selector-form {
  display: flex;
  flex-direction: row;
  gap: 20px;
  width: 100%;
}
.line-container {
  display: flex;
  align-items: center;
  padding-top: 15px;
  padding-bottom: 4px;
  width: 100%
}

.line-text {
  color: gray;
  white-space: nowrap;
  margin-right: 10px;
}

.line {
  height: 1px;
  background-color: black;
  flex-grow: 1;
}
.control-main{
  display: flex;
  flex-direction: column;
  width: 100%
}
.ai-form {
  display:flex;
  flex-direction: row;
  width: 95%;
  gap: 20px;
  margin-top:18px;
  background: #898686;
  padding: 14px;
  border-radius: 6px;
}
#input-ai{
  width: 74%;
  background: #e9e3e3;
}
#button-ai{
  width: 22%;
  background-color: #d46d6d;
}
    `}
</style>

<form id="mockDataForm">
    <div className="mdb-logo-container">
      <LeafyGreenMongoDBLogo color="green-base" />
    </div>
    <h2>Mock Data Generator</h2>
    <div className="selector-db-col">
      <div className="selector-form">
        <label>
          Database name
          <input
              type="text"
              id={'db-name'}
              value={this.state.database}
              onChange={e => this.setState({ database: e.target.value })}
              />
        </label>
        <label>
          Collection name
          <input
              type="text"
              id={'db-name'}
              value={this.state.collection}
              onChange={e => this.setState({ collection: e.target.value })}
              />
        </label>
      </div>
      <div className="line-container">
        <span className="line-text">Define data fields</span>
        <hr/>
    </div>
    </div>
    <div className="field-container column-flex data-types" ref={this.fieldsContainerRef}>
    {this.state.fields.map((field, index) => (
        <div key={index} className="field-container">
            <label>
                Field name
                <input
                    type="text"
                    id={`fieldName-${index}`}
                    value={field.name}
                    onChange={e => this.handleChangeFieldName(index, e.target.value)}
                />
            </label>
            <label>
                Field type
                <select
                    id={`fieldType-${index}`}
                    value={field.type}
                    onChange={e => this.handleChangeFieldType(index, e.target.value)}
                >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="productName">Product Name</option>
                    <option value="price">Price</option>
                    <option value="dateOfSale">Date Of Sale</option>
                    <option value="customerName">Customer Name</option>
                    <option value="quantity">Quantity</option>
                    <option value="firstName">First Name</option>
                    <option value="lastName">Last Name</option>
                    <option value="email">Email</option>
                    <option value="username">Username</option>
                    <option value="address">Address</option>
                    <option value="phone">Phone</option>
                    <option value="registrationDate">Registration Date</option>
                    <option value="blogTitle">Blog Title</option>
                    <option value="blogContent">Blog Content</option>
                    <option value="authorName">Author Name</option>
                    <option value="publishDate">Publish Date</option>
                    <option value="views">Views</option>
                </select>
            </label>
        </div>
    ))}
    </div>
    <div className="field-container column-flex">
    <div className="line-container">
        <span className="line-text">Configure & generate dataset</span>
        <hr/>
    </div>
    <div className="control-main">
      <div className="control">
        <label>
            Number of rows
            <input
                type="number"
                value={this.state.numberOfRows}
                onChange={e => this.setState({ numberOfRows: parseInt(e.target.value, 10) })}
                min="1"
            />
        </label>
        <button type="button" className="add-field" onClick={this.addField}>+ Add Field</button>
        <button type="button" className="ai-conf" onClick={() => this.setState({ aiVisible: !this.state.aiVisible })}>⚡️ Configure with AI</button>
        <button type="button" onClick={this.generateData}>Generate Mock Data</button>
        </div>
      {
      this.state.aiVisible &&
      <div className="ai-form">
        <input
          type="text"
          id="input-ai"
          placeholder="Describe your desired dataset (e.g Users with name, address, email)"
          value={this.state.aiPrompt}
          onChange={e => this.setState({ aiPrompt: e.target.value })}
          />
         <button id="button-ai" type="button" onClick={this.queryOpenAIFunc}> ⚡️ Ask AI</button>
      </div>
      }
    </div>
    </div>
    <div className={
    this.state.mockData && Object.keys(this.state.mockData).length > 0
    ? 'data-section data-generated'
    : 'data-section'}
>
    <h3>Generated Mock Data</h3>
    <pre>{JSON.stringify(this.state.mockData, null, 2)}</pre>
    <button type="button" className="insert-button" onClick={this.insertData}>Insert Data</button>
</div>
</form>
      </React.Fragment>
    );
  }
}


const mapDispatchToProps: DispatchProps = {
  toggleOpenMockDataGenerator: (
  ): OpenMockDataGeneratorAction => ({
    type: ActionTypes.OPEN_MOCK_DATA_GENERATOR,
  }),
  insertMockData: (codeToExecute): InsertMockDataAction => ({
    type: ActionTypes.INSERT_MOCK_DATA,
    data: codeToExecute
  }),
  queryOpenAI: (prompt): SendAiPromptAction => ({
    type: ActionTypes.SEND_AI_PROMPT,
    aiPrompt: prompt
  })
};


export default connect(null, mapDispatchToProps)(MockDataGenerator);
