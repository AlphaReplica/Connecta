'use strict';
const ConnectaEnums = require('./lib/ConnectaEnums');

const Connecta = 
{
    ConnectaAdapter :require('./lib/server/ConnectaAdapter'),
    ConnectaRedirect:require('./lib/server/ConnectaRedirect'),
    ConnectaServer  :require('./lib/server/ConnectaServer'),
    MessageType     :require('./lib/ConnectaEnums').MessageType,
    ConnectaEvents  :require('./lib/ConnectaEnums').ConnectaEvents,
    InternalEvents  :require('./lib/ConnectaEnums').InternalEvents,
    RootRoom        :require('./lib/ConnectaEnums').RootRoom
};

module.exports = Connecta;