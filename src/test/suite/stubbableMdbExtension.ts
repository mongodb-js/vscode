import MDBExtensionController from '../../mdbExtensionController';
import { ExtensionContextStub } from './stubs';

// This interface has the instance of the extension we use for testing.
// This should be used for integration tests and higher level extension
// command testing that cannot be done on a more isolated level.

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace mdbTestExtension {
  export let extensionContextStub: ExtensionContextStub;
  export let testExtensionController: MDBExtensionController;
}
