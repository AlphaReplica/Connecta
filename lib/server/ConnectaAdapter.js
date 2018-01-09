/**
 * Adapter for ConnectaConnection and ConnectaExternalMaster
 */

'use strict';
const fs                     = require('fs');
const https                  = require('https');
const WebSocket              = require('uws');
const ConnectaExternalMaster = require('./ConnectaExternalMaster');
const ConnectaConnection     = require('./ConnectaConnection');
const ConnectaDefaultValues  = require('./ConnectaDefaultValues');
const MessageType            = require('../ConnectaEnums').MessageType;
const InternalEvents         = require('../ConnectaEnums').InternalEvents;
const ProcessEvents          = require('../ConnectaEnums').ProcessEvents;

class ConnectaAdapter
{
    /**
    * @param {Number} port - Port to use
    * @param {Object} params - params Object, see connectaDefaultValues
    */
    constructor(port,params)
    {
        params = ConnectaDefaultValues.validateValues(params);
        
        if(params.divideConnections == true)
        {
            this.conn = new ConnectaExternalMaster(port,params);
        }
        else
        {
            this.conn = new ConnectaConnection(port,params);
        }

        this.conn.onClientConnected      = (obj        ) => {this.onAdapterClientConnected(obj);};
        this.conn.onClientDisconnected   = (obj        ) => {this.onAdapterClientDisconnected(obj);};
        this.conn.onClientMessage        = (obj        ) => {this.onAdapterClientMessage(id,obj);};
        this.conn.addOrRemoveFailedPeers = (add,id1,id2) => {this.updateFallbackList(add,id1,id2);}
    }
    
    /**
     * Invoked when peer connected
     * @method onAdapterClientConnected
     * @param {Object} obj - peer reference
    */
    onAdapterClientConnected(obj)
    {
        if(this.onPeerConnected)
        {
            this.onPeerConnected(obj);
        }
    }

    /**
     * Invoked when peer disconnected
     * @method onAdapterClientDisconnected
     * @param {Object} obj - peer reference
    */
    onAdapterClientDisconnected(obj)
    {
        if(this.onPeerDisConnected)
        {
            this.onPeerDisConnected(obj);
        }
    }

    /**
     * Invoked when peer message recieved
     * @method onAdapterClientMessage
     * @param {Object} obj - message
    */
    onAdapterClientMessage(obj)
    {
        if(this.onPeerMessage)
        {
            this.onPeerMessage(obj);
        }
    }

    /**
     * adds or removes peer ids to rtc fallback list
     * @method updateFallbackList
     * @param {Boolean} add - add ro remove
     * @param {String} id1 - peer 1 id
     * @param {String} id2 - peer 2 id
    */
    updateFallbackList(add,id1,id2)
    {
        if(add == true)
        {
            this.addToFallbackList(id1,id2);
        }
        else
        {
            this.removeFromFallbackList(id1,id2);
        }
    }

    /**
     * adds peer id to peer's fallback array
     * @method addToFallbackList
     * @param {String} target - peer 1 id
     * @param {String} to - peer 2 id
    */
    addToFallbackList(target,to)
    {
        if(this.conn)
        {
            if(to)
            {
                if(Array.isArray(to))
                {
                    for(var num = 0; num < to.length; num++)
                    {
                        if(to[num]!=target)
                        {
                            this.addToFallbackList(target,to[num]);
                        }
                    }
                }
                else if(to!=target)
                {
                    if(this.conn.peers[to] && this.conn.peers[to].failedPeers.indexOf(target)<0)
                    {
                        this.conn.peers[to].failedPeers.push(target);
                        this.conn.fallbackListUpdated(to);
                    }
                    if(this.conn.peers[target] && this.conn.peers[target].failedPeers.indexOf(to)<0)
                    {
                        this.conn.peers[target].failedPeers.push(to);
                        this.conn.fallbackListUpdated(target);
                    }
                }
            }
        }
    }

    /**
     * removes peer id from peer's fallback array
     * @method removeFromFallbackList
     * @param {String} target - peer 1 id
     * @param {String} to - peer 2 id
    */
    removeFromFallbackList(target,from)
    {
        if(this.conn)
        {
            if(from)
            {
                if(target!=from)
                {
                    if(this.conn.peers[target])
                    {
                        if(this.conn.peers[target].failedPeers.indexOf(from)>-1)
                        {
                            this.conn.peers[target].failedPeers.splice(this.conn.peers[target].failedPeers.indexOf(from),1);
                            this.conn.fallbackListUpdated(target);
                        }
                    }
                    if(this.conn.peers[from])
                    {
                        if(this.conn.peers[from].failedPeers.indexOf(target)>-1)
                        {
                            this.conn.peers[from].failedPeers.splice(this.conn.peers[from].failedPeers.indexOf(target),1);
                            this.conn.fallbackListUpdated(from);
                        }
                    }
                }
            }
            else
            {
                for (var key in this.conn.peers)
                {
                    if(target!=key)
                    {
                        this.removeFromFallbackList(target,key);
                    }
                }
            }
        }
    }
    
    /**
     * invoked when fallback message received from client
     * @method onRTCFallbackMessage
     * @param {String} msg - message to send
     * @param {Object} client - client connection object
    */
    onRTCFallbackMessage(msg,client)
    {
        if(client && client.failedPeers.length>0)
        {
            this.sendToPeers(client.failedPeers,msg);
        }
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
        if(id && data && this.conn)
        {
            this.conn.sendToPeer(id,data);
        }
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
        if(id && ev && data && this.conn)
        {
            this.sendToPeer(id,JSON.stringify({ev:ev,data:data}));
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
        if(ids && ids.length>0 && ev && data)
        {
            this.sendToPeers(ids,JSON.stringify({ev:ev,data:data}),except);
        }
    }

    /**
     * broadcasts message to every connected peer
     * @method broadcast
     * @param {String} msg - message to send
    */
    broadcast(msg)
    {
        if(this.conn)
        {
            this.conn.broadcast(msg);
        }
    }
    
    /**
     * broadcasts message with event to every connected peer
     * @method broadcastEvent
     * @param {String} ev - event to send
     * @param {String} msg - message to send
    */
    broadcastEvent(ev,msg)
    {
        this.broadcast(JSON.stringify({ev:ev,data:msg}));
    }

    /**
     * returns Array of objects with process ids and connection count
     * @method peersList
    */
    serverLoad()
    {
        if(this.conn)
        {
            return this.conn.serverLoad();
        }
        return [];
    }
}

module.exports = ConnectaAdapter;