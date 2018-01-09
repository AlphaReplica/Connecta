/**
 * ConnectaServer
 * 
 * Created by Mujirishvili Beka
 */


'use strict';

const EventEmitter       = require('events');
const ConnectaRoom       = require('./ConnectaRoom');
const ConnectaAdapter    = require('./ConnectaAdapter');
const InternalEvents     = require('../ConnectaEnums').InternalEvents;
const ConnectaEvents     = require('../ConnectaEnums').ConnectaEvents;
const RootRoom           = require('../ConnectaEnums').RootRoom;

class ConnectaServer extends EventEmitter
{
    /**
    * @param {Number} port - Port to use
    * @param {Object} params - params Object, see connectaDefaultValues
    */
    constructor (port,params)
    {
        super();
        this.createRoom(RootRoom,false,false,false,false,true);
        
        this.conn = new ConnectaAdapter(port,params);
        this.conn.onPeerConnected    = (obj)=>{this.onPeerConnected(obj);};
        this.conn.onPeerDisConnected = (obj)=>{this.onPeerDisConnected(obj);};
        this.conn.onPeerMessage      = (obj)=>{this.onClientMessage(id,obj);};
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
        this.conn.sendEventToPeer(id,ev,data);
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
        this.conn.sendEventToPeers(ids,data,except);
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
        this.conn.broadcastMessage(msg);
    }
    
    /**
     * broadcasts message with event to every connected peer
     * @method broadcastEvent
     * @param {String} ev - event to send
     * @param {String} data - message to send
    */
    broadcastEvent(ev,data)
    {
        this.conn.broadcastEvent(ev,data);
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
     * Invoked when peer disconnects
     * @method onPeerDisConnected
     * @param {Object} client - peer reference
    */
    onPeerDisConnected(client)
    {
        if(client.room)
        {
            var room = client.room;
            room.removeClient(client);

            if(room.clientCount()>0 && room.autoDelete == true)
            {
                this.deleteRoom(room.name);
            }
        }
        this.emit(ConnectaEvents.DISCONNECTED,client);
    }

    /**
     * Invoked when peer message recieved
     * @method onClientMessage
     * @param {Object} id - client id
     * @param {Object} data - message
    */
    onClientMessage(id,data)
    {
        this.emit(id,data.ev,data.data);
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
     * @param {Boolean} sendUsersListOnJoin - send room users ids array
     * @param {Boolean} silent - don't send any event, eg: join/left room
    */
    createRoom(id,useRTC,autoDelete,rtcFallbackEnabled,sendUsersListOnJoin,silent)
    {
        if(!this.rooms)
        {
            this.rooms = {};
        }
        if(!this.rooms[id])
        {
            this.rooms[id] = new ConnectaRoom(this,id,useRTC,rtcFallbackEnabled,autoDelete,sendUsersListOnJoin,silent);

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