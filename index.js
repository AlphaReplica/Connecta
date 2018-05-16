'use strict';
const ConnectaEnums = require('./lib/ConnectaEnums');

const Connecta = 
{
    ConnectaServer  :require('./lib/server/ConnectaServer'),
    ByteArrayUtils  :require('./lib/ByteArrayUtils'),
    MessageType     :require('./lib/ConnectaEnums').MessageType,
    ConnectaEvents  :require('./lib/ConnectaEnums').ConnectaEvents,
    InternalEvents  :require('./lib/ConnectaEnums').InternalEvents,
    RootRoom        :require('./lib/ConnectaEnums').RootRoom
};

module.exports = Connecta;