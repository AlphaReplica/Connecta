/**
 * Every enum what server uses internally
 */

'use strict';

// Message types, first char in string represents one of the types of message to make difference between messages
var MessageType = 
{
    RTC:1,
    RTC_FAIL:2,
    MESSAGE:3,
    PING:4
};

// Used only between process communication
var ProcessEvents = 
{
    ON_CONNECTED:1,
    ON_CLIENT_CONNECTED:2,
    ON_CLIENT_DISCONNECTED:3,
    ON_EVENT_MESSAGE:4,
    ON_MESSAGE:5,
    ON_MESSAGE_TRANSFER:6,
    ON_RTC_FAIL_UPDATE:7
}

// Used by server/client message types
var InternalEvents = 
{
    REDIRECT:-1,
    CONNECTED:-2,
    SDP_DESCRIPTION:-3,
    ICE_CANDIDATE:-4,
    RTC_CONNECT:-5,
    RTC_DISCONNECT:-6,
    RTC_FALLBACK_LIST:-7,
    RTC_FALLBACK:-8,
    JOINED_ROOM:-9,
    USER_JOINED_ROOM:-10,
    LEFT_ROOM:-11,
    USER_LEFT_ROOM:-12,
    ROOM_PARAMS:-13,
    PING:-14
}

// Used by server as event types
var ConnectaEvents = 
{
    CONNECTED:"connected",
    BEFORE_DISCONNECTED:"beforeDisconnected",
    DISCONNECTED:"disconnected",
    ROOM_CREATED:"roomCreated",
    ROOM_DELETED:"roomDeleted",
    EVENT_MESSAGE:"onEventMessage",
    RAW_MESSAGE:"onRawMessage",
    ON_BYTE_ARRAY:"onByteArray"
}

var RootRoom = '/'; // default root room name where all connections are joined

if(typeof module != 'undefined')
{
    if(module.exports)
    {
        module.exports.MessageType    = MessageType;
        module.exports.ProcessEvents  = ProcessEvents;
        module.exports.InternalEvents = InternalEvents;
        module.exports.ConnectaEvents = ConnectaEvents;
        module.exports.RootRoom       = RootRoom;
    }
}