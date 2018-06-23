/**
 * ConnectaRoom manages user groups
 */

'use strict';

const ConnectaServer = require('./ConnectaServer');
const InternalEvents = require('../ConnectaEnums').InternalEvents;
const MessageType    = require('../ConnectaEnums').MessageType;
const ByteArrayUtils = require('../ByteArrayUtils');

class ConnectaRoom
{
    /**
    * @param {Object}   server - Websocket server reference
    * @param {String}   name - Room name
    * @param {Boolean}  roomParams - room parameters
    * @param {Boolean}  useRTC - can webRTC enabled in this room
    * @param {Boolean}  rtcFallbackEnabled - can failed webRTC connections send fallback messages to server
    * @param {Boolean}  autoDelete - auto delete on last user leave
    * @param {Boolean}  silent - don't send any event, eg: join/left room
    * @param {ByteType} byteType - byteType to use in room, default is ByteType.Int16Array
    */
    constructor(server,name,roomParams,useRTC,rtcFallbackEnabled,autoDelete,silent,byteType)
    {
        this.name               = name;
        this.clients            = {};
        this.roomParams         = (roomParams) ? roomParams : {};
        this.useRTC             = useRTC;
        this.autoDelete         = autoDelete;
        this.silent             = silent;
        this.rtcFallbackEnabled = rtcFallbackEnabled;
        this.byteType           = (byteType) ? byteType : ByteArrayUtils.ByteType.Int16Array;
        this.server             = server;
    }

    /**
     * returns array of objects with id and rtc id
     * @method roomClientsWithRTCId
    */
    roomClientsWithRTCId()
    {
        var peers = Object.keys(this.clients);
        var arr   = [];
        for(var num = 0; num < peers.length; num++)
        {
            arr.push({id:this.clients[peers[num]].id,rtcId:this.clients[peers[num]].rtcId});
        }
        return arr;
    }

    /**
     * returns peer by given rtc id
     * @method getPeerByRTCId
    */
    getPeerByRTCId(id)
    {
        for (var key in this.clients)
        {
            if(this.clients[key].rtcId == id)
            {
                return this.clients[key];
            }
        }
        return null;
    }

    /**
     * returns unasigned number ranging from 0 to 128
     * @method getUniqueRTCId
    */
    getUniqueRTCId()
    {
        for(var num = 1; num < 128; num++)
        {
            if(this.getPeerByRTCId(num) == null)
            {
                return num;
            }
        }
        return -1;
    }

    /**
     * returns room users
     * @method peersCount
    */
    roomClients()
    {
       return Object.values(this.clients);
    }
   
    /**
     * returns room user Ids
     * @method peersCount
    */
    roomClientIds()
    {
        return Object.keys(this.clients);
    }
    
    /**
     * returns room users count
     * @method clientCount
    */
    clientCount()
    {
        return Object.keys(this.clients).length;
    }

    /**
     * adds client to room, other users get notified on user join
     * @method addClient
     * @param {Object} client - peer reference
    */
    addClient(client)
    {
        if(client.room && client.room!=this)
        {
            client.room.removeClient(client);
        }
        if(!this.clients[client.id])
        {
            client.room = this;
            client.failedPeers = [];
            this.clients[client.id] = client;
            client.rtcId = this.getUniqueRTCId();
            if(this.rtcFallbackEnabled == true)
            {
                this.server.addToFallbackList(client.id,this.roomClientIds());
            }
        }
        if(this.silent == false)
        {
            var obj = {room:this.name,rtcId:client.rtcId,useRTC:this.useRTC,rtcFallback:this.rtcFallbackEnabled,byteType:this.byteType,params:this.roomParams};
            
            if(this.useRTC && this.rtcFallbackEnabled)
            {
                obj.users = this.roomClientsWithRTCId();
            }
            
            this.sendEventTo(client.id,InternalEvents.JOINED_ROOM,obj);
            this.broadcastEvent(InternalEvents.USER_JOINED_ROOM,{id:client.id,rtcId:client.rtcId},client.id);
        }
    }

    /**
     * Broadcasts custom param object to room
     * @method broadcastRoomParams
    */
    broadcastRoomParams()
    {
        this.broadcastEvent(InternalEvents.ROOM_PARAMS,this.roomParams);
    }

    /**
     * removes client to room, other users get notified on user left
     * @method removeClient
     * @param {Object} client - peer reference
    */
    removeClient(client)
    {
        client.room   = null;
        client.rtcId = -1;
        if(this.rtcFallbackEnabled == true)
        {
            this.server.removeFromFallbackList(client.id);
        }
        client.failedPeers = [];

        if(this.clients[client.id])
        {
            delete this.clients[client.id];
        }
        if(this.silent == false)
        {
            this.sendEventTo(client.id,InternalEvents.LEFT_ROOM);
            this.broadcastEvent(InternalEvents.USER_LEFT_ROOM,client.id,client.id);
        }
    }

    /**
     * Broadcasts event to room
     * @method broadcastEvent
     * @param {String} ev - event to send
     * @param {String} data - data to send
     * @param {String} except - peer id to except sending
    */
    broadcastEvent(ev,data,except)
    {
        this.server.sendEventToPeers(this.roomClientIds(),ev,data,except);
    }
    
    /**
     * Broadcasts message to room
     * @method broadcast
     * @param {String} msg - data to send
     * @param {String} except - peer id to except sending
    */
    broadcast(msg,except)
    {
        this.server.sendToPeers(this.roomClientIds(),msg,except);
    }
    
    /**
     * sends event to given peer by id
     * @method sendEventTo
     * @param {String} id - peer id to send event
     * @param {String} ev - event to send
     * @param {String} data - data to send
    */
    sendEventTo(id,ev,data)
    {
        this.server.sendEventToPeer(id,ev,data);
    }
    
    /**
     * sends message to given peer by id
     * @method broadcast
     * @param {String} id - peer id to send message
     * @param {String} msg - data to send
    */
    sendToPeer(id,msg)
    {
        this.server.sendToPeer(id,msg);
    }

    /**
     * creates array by defined array type in room
     * @method broadcast
     * @param {int} size - array size
    */
    createArray(size)
    {
        return ByteArrayUtils.createTypedArray(this.byteType, size + ((this.useRTC == true && this.rtcFallbackEnabled == true) ? 1 : 0));
    }
}

module.exports = ConnectaRoom;