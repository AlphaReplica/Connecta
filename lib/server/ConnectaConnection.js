/**
 * ConnectaConnection object listens to port and websocket connections
 */

'use strict';
const fs             = require('fs');
const https          = require('https');
const WebSocket      = require('uws');
const MessageType    = require('../ConnectaEnums').MessageType;
const InternalEvents = require('../ConnectaEnums').InternalEvents;
const ProcessEvents  = require('../ConnectaEnums').ProcessEvents;

class ConnectaConnection
{
    /**
    * @param {Number} port - Port to use
    * @param {Object} params - params Object, see connectaDefaultValues
    * @param {Boolean} autoStart - start on instance creation
    */
    constructor(port,params,autoStart)
    {
        autoStart   = (autoStart == true || autoStart == false) ? autoStart : true;
        this.config = {};
        this.port   = port;

        if(params.key .toString().indexOf('.pem')>-1)
        {
            this.config.key  = fs.readFileSync(params.key);
        }
        if(params.cert.toString().indexOf('.pem')>-1)
        {
            this.config.key  = fs.readFileSync(params.cert);
        }
        if(params.passphrase.length>0)
        {
            this.config.passphrase = params.passphrase;
        }
        if(autoStart)
        {
            this.startServer();
        }
    }

    /**
     * Starts webserver by config params
     * @method startServer
    */
    startServer()
    {
        if(this.config.key)
        {
            this.https = https.createServer(this.config);
            this.https.listen(port, '0.0.0.0');

            this.config.server = this.https;
        }
        else
        {
            this.config.port = this.port;
        }
        this.peers  = {};
        this.server = new WebSocket.Server(this.config);
        this.server.on('connection', (client)=>{this.onConnection(client);});
    }


    /**
     * Stops server and clears peers dictionary
     * @method stopServer
    */
    stopServer()
    {
        if(this.server)
        {
            this.server.close();
            for (var key in this.peers)
            {
                this.peers[key].close();
            }
            this.peers = {};
        }
    }

    /**
     * Invoked when peer connected, adds listeners to client reference and adds in clients dictionary
     * @method onConnection
     * @param {Object} client - peer reference
    */
    onConnection(client)
    {
        client.id             = this.generateId();
        client.failedPeers    = [];
        this.peers[client.id] = client;
        
        client.on('message', (message)=>
        {
            this.onmessage(message,client);
        });
        client.on('close',(e)=>
        {
            this.onDisconnect(client);
        });
        if(this.onClientConnected)
        {
            this.onClientConnected(client);
        }
    }

    /**
     * Invoked when peer disconnected, removes client from peers dictionary
     * @method onDisconnect
     * @param {Object} client - peer reference
    */
    onDisconnect(client)
    {
        if(this.onClientDisconnected)
        {
            this.onClientDisconnected(client);
        }
        let id = client.id;
        if(this.peers[id])
        {
            delete this.peers[id];
        }
    }

    /**
     * Invoked when received message from peer, splits first char by message type and invokes message according to type
     * @method onmessage
     * @param {String} msg - message
     * @param {Object} client - peer reference
    */
    onmessage(msg,client)
    {
        if(msg.length>0)
        {
            var char = Number(msg[0]);
            var pack = msg.substring(1,msg.length);
            
            switch(char)
            {
                case MessageType.RTC:
                {
                    this.onRTCMessage(pack,client);
                    break;
                }
                case MessageType.RTC_FAIL:
                {
                    this.onRTCFallbackMessage(pack,client);
                    break;
                }
                case MessageType.MESSAGE:
                {
                    var message = JSON.parse(pack);
                    if(this.onClientMessage)
                    {
                        this.onClientMessage(client.id,message);
                    }
                    break;
                }
            }
        }
    }

    /**
     * Invoked when received RTC related message
     * @method onRTCMessage
     * @param {String} data - message
     * @param {Object} client - peer reference
    */
    onRTCMessage(data,client)
    {
        var message = JSON.parse(data);
        switch(message.ev)
        {
            case InternalEvents.ICE_CANDIDATE:
            case InternalEvents.SDP_DESCRIPTION:
            {
                var to     = message.id;
                message.id = client.id;
                this.sendToPeer(to,JSON.stringify(message));
                break;
            }
            case InternalEvents.RTC_CONNECT:
            case InternalEvents.RTC_DISCONNECT:
            {
                if(this.addOrRemoveFailedPeers)
                {
                    this.addOrRemoveFailedPeers((message.ev == InternalEvents.RTC_DISCONNECT),client.id,message.id);
                }
                break;
            }
        }
    }

    /**
     * called when peer fallback list updated, if data!=undefined peer's fallback array will be set
     * @method fallbackListUpdated
     * @param {Object} id - peer id
     * @param {Array} data - peer ids array
    */
    fallbackListUpdated(id,data)
    {
        if(this.peers[id])
        {
            if(data)
            {
                this.peers[id].failedPeers = data;
            }
            this.sendEventToPeer(id,InternalEvents.RTC_FALLBACK_LIST,this.peers[id].failedPeers.length);
        }
    }

    /**
     * called when peer couldn't send direct rtc message and it sends to server
     * @method onRTCFallbackMessage
     * @param {Object} client - peer reference
     * @param {String} msg - message
    */
    onRTCFallbackMessage(msg,client)
    {
        if(client && client.failedPeers.length>0)
        {
            this.sendToPeers(client.failedPeers,msg);
        }
    }

    /**
     * sends message with event to peer by id
     * @method sendEventToPeer
     * @param {Object} id - peer id
     * @param {String} ev - event to send
     * @param {String} data - data to send
    */
    sendEventToPeer(id,ev,data)
    {
        if(id && ev && data!=='undefined')
        {
            this.sendToPeer(id,JSON.stringify({ev:ev,data:data}));
        }
    }

    /**
     * sends message to peer by id
     * @method sendToPeer
     * @param {Object} id - peer id
     * @param {String} data - data to send
    */
    sendToPeer(id,data)
    {
        if(data)
        {
            if(this.peers[id])
            {
                if(this.peers[id].readyState === WebSocket.OPEN)
                {
                    this.peers[id].send(data);
                }
            }
            else
            {
                if(this.noPeerIdFound)
                {
                    this.noPeerIdFound(id,data);
                }
            }
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
            for(var num = 0; num < ids.length; num++)
            {
                if(ids[num]!=except)
                {
                    this.sendToPeer(ids[num],data);
                }
            }
        }
    }

    /**
     * broadcasts message to every connected peer
     * @method broadcast
     * @param {String} msg - message to send
    */
    broadcast(msg)
    {
        for (var key in this.peers)
        {
            this.sendToPeer(key,msg);
        }
    }
    
    /**
     * returns connected peers count
     * @method peersCount
    */
    peersCount()
    {
        if(this.server)
        {
            return Object.keys(this.peers).length;
        }
        return 0;
    }
    
    /**
     * returns peer by id
     * @method getPeer
     * @param {String} id - peer id
    */
    getPeer(id)
    {
        return this.peers[id];
    }

    /**
     * returns connected peers id array
     * @method peersList
    */
    peersList()
    {
        return Object.keys(this.peers);
    }

    /**
     * returns Array of objects with process ids and connection count
     * @method peersList
    */
    serverLoad()
    {
        return [{id:process.pid,peers:this.peersCount()}];
    }

    /**
     * generates unique id based on milisconds and process pid
     * @method generateId
    */
    generateId()
    {
        var date = new Date();
        var id   = [date.getDate(),date.getHours(),date.getMinutes(),date.getSeconds(),date.getMilliseconds()].join("");
        
        function s4(key)
        {
            return Math.floor((((key) ? key : 1) + Math.random()) * 0x10000).toString(16).substring(1);
        }
        date = null;
        return s4(id) + s4(process.pid);
    }
}

module.exports = ConnectaConnection;