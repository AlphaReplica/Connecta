/**
 * ConnectaRoom manages user groups
 */

'use strict';

const ConnectaServer = require('./ConnectaServer');
const InternalEvents = require('../ConnectaEnums').InternalEvents;
const MessageType    = require('../ConnectaEnums').MessageType;

class ConnectaRoom
{
    /**
    * @param {Object} server - Websocket server reference
    * @param {String} name - Room name
    * @param {Boolean} useRTC - can webRTC enabled in this room
    * @param {Boolean} rtcFallbackEnabled - can failed webRTC connections send fallback messages to server
    * @param {Boolean} autoDelete - auto delete on last user leave
    * @param {Boolean} sendUsersListOnJoin - send room users ids array
    * @param {Boolean} silent - don't send any event, eg: join/left room
    */
    constructor(server,name,useRTC,rtcFallbackEnabled,autoDelete,sendUsersListOnJoin,silent)
    {
        this.name               = name;
        this.clients            = {};
        this.useRTC             = useRTC;
        this.autoDelete         = autoDelete;
        this.silent             = silent;
        this.rtcFallbackEnabled = rtcFallbackEnabled;
        this.server             = server;
    }

    /**
     * returns room users
     * @method peersCount
    */
    roomClients()
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
            if(this.rtcFallbackEnabled == true)
            {
                this.server.addToFallbackList(client.id,this.roomClients());
            }
        }
        if(this.silent == false)
        {
            var obj = {room:this.name,useRTC:this.useRTC,rtcFallback:this.rtcFallbackEnabled};
            
            if(this.sendUsersListOnJoin == true)
            {
                obj.users = this.roomClients();
            }

            this.sendEventTo(client.id,InternalEvents.JOINED_ROOM,obj);
            this.broadcastEvent(InternalEvents.JOIN_ROOM,client.id,client.id);
        }
    }

    /**
     * removes client to room, other users get notified on user left
     * @method removeClient
     * @param {Object} client - peer reference
    */
    removeClient(client)
    {
        client.room = null;
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
            this.broadcastEvent(InternalEvents.LEFT_ROOM,client.id,client.id);
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
        this.server.sendEventToPeers(this.roomClients(),ev,data,except);
    }
    
    /**
     * Broadcasts message to room
     * @method broadcast
     * @param {String} msg - data to send
     * @param {String} except - peer id to except sending
    */
    broadcast(msg,except)
    {
        this.server.sendToPeers(this.roomClients(),msg,except);
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
}

module.exports = ConnectaRoom;