// This connection model is a browser version of https://github.com/mongodb-js/connection-model
// It mostly stores and validates data.

// Options: Message pass with main and keep the data model on the extension.
//  - Does this take a lot of messages? not real time? Things might get lost?
//  - Might be clean... How do differentiate state input though.
//  - Hacky - probably don't do.
// Have our own connection model here.
//  - Loaded at the end to the extension which builds into current connection model.
//  - Most straight forward solution
//  - Code duplication with connection model though.
//  - A good amount of code pulling connection model over and ensuring it can
//    rehydrated when passed to main.
// Reformat connection model to have a websafe version??
//  - How do we do some of the validation and breaking of file handling out.
//  - Would be nice...
//  - ssh tunneling?
//  - Connections and driver still needs to be used at some point which I think make
//    this infeasible.
