/**
 * ConnectaServer
 * 
 * Created by Mujirishvili Beka
 */

'use strict';

const EventEmitter          = require('events');
const ConnectaRoom          = require('./ConnectaRoom');
const ConnectaConnection    = require('./ConnectaConnection');
const ConnectaDefaultValues = require('./ConnectaDefaultValues');
const InternalEvents        = require('../ConnectaEnums').InternalEvents;
const ConnectaEvents        = require('../ConnectaEnums').ConnectaEvents;
const RootRoom              = require('../ConnectaEnums').RootRoom;

class ConnectaServer extends EventEmitter
{
    /**
    * @param {Number} port - Port to use
    * @param {Object} params - params Object, see connectaDefaultValues
    */
    constructor (port,params)
    {
        super();
        this.createRoom(RootRoom,null,false,false,false,true);
        
        params = ConnectaDefaultValues.validateValues(params);
        
        this.conn = new ConnectaConnection(port,params);

        this.conn.onClientConnected          = (obj          ) => {this.onPeerConnected(obj);};
        this.conn.onBeforeClientDisconnected = (obj          ) => {this.onBeforePeerDisconnected(obj);};
        this.conn.onClientDisconnected       = (obj          ) => {this.onPeerDisConnected(obj);};
        this.conn.onClientMessage            = (client,obj   ) => {this.onClientMessage(client,obj);};
        this.conn.onRawMessage               = (client,obj   ) => {this.onRawMessage   (client,obj);};
        this.conn.onByteData                 = (client,arr   ) => {this.onByteMessage  (client,arr);};
        this.conn.onPostRequest              = (method,params) => {return this.onPostRequest(method,params);};
    }

    /**
     * POST request, should return object
     * @method onPostRequest
     * @param {string} method - method
     * @param {Array } params - params
    */
    onPostRequest(method,params)
    {
        return null;
    }

    /**
     * returns peer by id
     * @method getPeer
     * @param {String} id - peer id
    */
    getPeer(id)
    {
        if(this.conn)
        {
            return this.conn.getPeer(id);
        }
        return {};
    }
    
    /**
     * returns connected peers count
     * @method peersCount
    */
    peersCount()
    {
        if(this.conn)
        {
            return this.conn.peersCount();
        }
        return 0;
    }

    /**
     * returns connected peers id array
     * @method peersList
    */
    peersList()
    {
        if(this.conn)
        {
            return this.conn.peersList();
        }
        return [];
    }

    /**
     * sends message to peer by id
     * @method sendToPeer
     * @param {String} id - peer id
     * @param {String} data - message to send
    */
    sendToPeer(id,data)
    {
        this.conn.sendToPeer(id,data);
    }
    
    /**
     * sends message with event to peer by id
     * @method sendEventToPeer
     * @param {String} id - peer id
     * @param {String} ev - event to send
     * @param {String} data - message to send
    */
    sendEventToPeer(id,ev,data)
    {
        if(id && ev)
        {
            this.conn.sendEventToPeer(id,ev,data);
        }
    }

    /**
     * sends message to peers
     * @method sendToPeers
     * @param {Array} ids - peer ids array
     * @param {String} data - message to send
     * @param {String} except - sends to everybody except given id
    */
    sendToPeers(ids,data,except)
    {
        if(ids && ids.length>0 && data)
        {
            this.conn.sendToPeers(ids,data,except);
        }
    }

    /**
     * sends message with event to peers
     * @method sendEventToPeers
     * @param {Array} ids - peer ids array
     * @param {String} ev - event to send
     * @param {String} data - message to send
     * @param {String} except - sends to everybody except given id
    */
    sendEventToPeers(ids,ev,data,except)
    {
        this.conn.sendEventToPeers(ids,ev,data,except);
    }
    
    /**
     * broadcasts message with event to every peer in room
     * @method broadcastEventToRoom
     * @param {String} room - room id
     * @param {String} ev - event to send
     * @param {String} message - message to send
    */
    broadcastEventToRoom(room,ev,message)
    {
        if(this.rooms)
        {
            if(this.rooms[room])
            {
                this.rooms[room].broadcastEvent(ev,message);
            }
        }
    }

    /**
     * broadcasts message to every peer in room
     * @method broadcastToRoom
     * @param {String} room - room id
     * @param {String} message - message to send
    */
    broadcastToRoom(room,message)
    {
        if(this.rooms)
        {
            if(this.rooms[room])
            {
                this.rooms[room].broadcast(message);
            }
        }
    }

    /**
     * broadcasts message to every connected peer
     * @method broadcast
     * @param {String} msg - message to send
    */
    broadcastMessage(msg)
    {
        this.conn.broadcast(msg);
    }
    
    /**
     * broadcasts message with event to every connected peer
     * @method broadcastEvent
     * @param {String} ev - event to send
     * @param {String} data - message to send
    */
    broadcastEvent(ev,msg)
    {
        this.conn.broadcastEvent(ev,msg);
    }

    /**
     * Invoked when peer connects
     * @method onPeerConnected
     * @param {Object} client - peer reference
    */
    onPeerConnected(client)
    {
        this.sendEventToPeer(client.id,InternalEvents.CONNECTED,client.id);
        this.rooms[RootRoom].addClient(client);
        this.emit(ConnectaEvents.CONNECTED,client);
    }

    /**
     * Invoked before peer gets disconnected
     * @method onBeforePeerDisconnected
     * @param {Object} client - peer reference
    */
    onBeforePeerDisconnected(client)
    {
        this.emit(ConnectaEvents.BEFORE_DISCONNECTED,client);
        if(client.room)
        {
            var room = client.room;
            room.removeClient(client);

            if(room.clientCount()==0 && room.autoDelete == true)
            {
                this.deleteRoom(room.name);
            }
        }
    }
	
    /**
     * Invoked when peer disconnects
     * @method onPeerDisConnected
     * @param {Object} client - peer reference
    */
    onPeerDisConnected(client)
    {
        this.emit(ConnectaEvents.DISCONNECTED,client);
    }

    /**
     * Invoked when peer message recieved
     * @method onClientMessage
     * @param {Object} client - client
     * @param {Object} data - message
    */
    onClientMessage(client,data)
    {
        this.emit(ConnectaEvents.EVENT_MESSAGE,client,data);
    }

    /**
     * Invoked when peer unparsed message recieved
     * @method onRawMessage
     * @param {Object} client - client
     * @param {Object} data - message
    */
    onRawMessage(client,data)
    {
        this.emit(ConnectaEvents.RAW_MESSAGE,client,data);
    }

    /**
     * Invoked when peer byte array recieved
     * @method onRawMessage
     * @param {Object} client - client
     * @param {Object} arr - bytearray
    */
    onByteMessage(client,arr)
    {
        this.emit(ConnectaEvents.ON_BYTE_ARRAY,client,arr);
    }

    /**
     * adds peer id to peer's fallback array
     * @method addToFallbackList
     * @param {String} target - peer 1 id
     * @param {String} to - peer 2 id
    */
    addToFallbackList(target,to)
    {
        this.conn.addToFallbackList(target,to);
    }

    /**
     * removes peer id from peer's fallback array
     * @method removeFromFallbackList
     * @param {String} target - peer 1 id
     * @param {String} from - peer 2 id
    */
    removeFromFallbackList(target,from)
    {
        this.conn.removeFromFallbackList(target,from);
    }
    
    /**
     * returns rooms count
     * @method roomsCount
    */
   roomsCount()
   {
       return Object.keys(this.rooms).length;
   }

    /**
     * returns rooms array
     * @method roomsList
    */
    roomsList()
    {
        return Object.keys(this.rooms);
    }

    /**
     * returns room by id
     * @method getRoom
     * @param {String} name - room name
    */
    getRoom(name)
    {
        if(this.rooms)
        {
            return this.rooms[name];
        }
        return {};
    }
    
    /**
     * returns room clients by room id
     * @method getRoomClients
     * @param {String} name - room name
    */
    getRoomClients(name)
    {
        if(this.rooms)
        {
            if(this.rooms[name])
            {
                return this.rooms[name].roomClients();
            };
        }
        return [];
    }

    /**
     * returns room client ids by room id
     * @method getRoomClientIds
     * @param {String} name - room name
    */
    getRoomClientIds(name)
    {
        if(this.rooms)
        {
            if(this.rooms[name])
            {
                return this.rooms[name].roomClientIds();
            };
        }
        return [];
    }

    /**
     * returns room clients count by room id
     * @method getRoomClientsCount
     * @param {String} name - room name
    */
    getRoomClientsCount(name)
    {
        if(this.rooms)
        {
            if(this.rooms[name])
            {
                return this.rooms[name].clientCount();
            };
        }
        return 0;
    }

    /**
     * creates new room by name
     * @method createRoom
     * @param {String} id - Room name
     * @param {Boolean} useRTC - can webRTC enabled in this room
     * @param {Boolean} autoDelete - auto delete on last user leave
     * @param {Boolean} rtcFallbackEnabled - can failed webRTC connections send fallback messages to server
     * @param {Boolean} silent - don't send any event, eg: join/left room
     * @param {Type}    byteType - byteType to use in room, default is Int16Array
    */
    createRoom(id,roomParams,useRTC,autoDelete,rtcFallbackEnabled,silent,byteType)
    {
        if(!this.rooms)
        {
            this.rooms = {};
        }
        if(!this.rooms[id])
        {
            this.rooms[id] = new ConnectaRoom(this,id,roomParams,useRTC,rtcFallbackEnabled,autoDelete,silent,byteType);

            this.emit(ConnectaEvents.ROOM_CREATED,id);

            return this.rooms[id];
        }
        return null;
    }

    /**
     * deletes room by id
     * @method deleteRoom
     * @param {String} id - Room name
    */
    deleteRoom(id)
    {
        if(!this.rooms)
        {
            this.rooms = {};
            return;
        }
        if(this.rooms[id])
        {
            if(this.rooms[id].clientCount()>0)
            {
                this.transferClientsToRoom(id,RootRoom);
            }

            this.rooms[id] = null;
            delete this.rooms[id];
            this.emit(ConnectaEvents.ROOM_DELETED,id);
        }
    }

    /**
     * adds client to specific room
     * @method addClientToRoom
     * @param {String} clientId - Peer Id
     * @param {String} room - Room Name
    */
    addClientToRoom(clientId,room)
    {
        if(this.rooms && clientId && room)
        {
            if(this.rooms[room])
            {
                this.rooms[room].addClient(this.getPeer(clientId));
            }
        }
    }

    /**
     * removes client from specific room
     * @method removeClientFromRoom
     * @param {String} clientId - Peer Id
     * @param {String} room - Room Name
    */
    removeClientFromRoom(clientId,room)
    {
        if(this.rooms && clientId && room)
        {
            var client = this.getPeer(clientId);
            if(this.rooms[room] && client)
            {
                var from   = client.room;
                this.rooms[RootRoom].addClient(this.getPeer(clientId));

                if(from)
                {
                    if(from.clientCount()==0)
                    {
                        if(from.autoDelete)
                        {
                            this.deleteRoom(from.name);
                        }
                    }
                }
            }
        }
    }

    /**
     * transfers room clients from another room
     * @method transferClientsToRoom
     * @param {String} from - Peers to transfer from
     * @param {String} to - Peers to transfer to
    */
    transferClientsToRoom(from,to)
    {
        if(this.rooms)
        {
            if(this.rooms[from] && this.rooms[to])
            {
                for (var key in this.rooms[from].clients)
                {
                    this.rooms[to].addClient(this.rooms[from].clients[key]);
                }
                if(this.rooms[from].autoDelete)
                {
                    this.deleteRoom(from);
                }
            }
        }
    }
}

module.exports = ConnectaServer;