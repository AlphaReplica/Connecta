/**
 * ConnectaConnection object listens to port and websocket connections
 */

'use strict';
const fs             = require('fs');
const http           = require('http');
const https          = require('https');
const WebSocket      = require('uws');
const MessageType    = require('../ConnectaEnums').MessageType;
const InternalEvents = require('../ConnectaEnums').InternalEvents;
const ProcessEvents  = require('../ConnectaEnums').ProcessEvents;
const ByteArrayUtils = require('../ByteArrayUtils');

class ConnectaConnection
{
    /**
    * @param {Number} port - Port to use
    * @param {Object} params - params Object, see connectaDefaultValues
    * @param {Boolean} autoStart - start on instance creation
    */
    constructor(port,params,autoStart)
    {
        autoStart       = (autoStart == true || autoStart == false) ? autoStart : true;
        this.config     = {};
        this.port       = port;
        this.encrypt    = params.encryptMessage;
        this.rootKey    = params.rootKey;

        if(params.key .toString().indexOf('.pem')>-1)
        {
            this.config.key = fs.readFileSync(params.key);
        }
        if(params.cert.toString().indexOf('.pem')>-1)
        {
            this.config.cert = fs.readFileSync(params.cert);
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
            this.https = https.createServer(this.config,(req,res) => {this.serverRequest(req,res);});
            this.https.listen(port, '0.0.0.0');

            this.config.server = this.https;
        }
        else
        {
            this.http = http.createServer((req,res) => {this.serverRequest(req,res);});
            this.http.listen(this.port,'0.0.0.0');
            
            this.config.server = this.http;
        }

        this.peers  = {};
        this.server = new WebSocket.Server(this.config);
        this.server.on('connection', (client)=>{this.onConnection(client);});
    }

    /**
     * Invoked when http post
     * for example http://hostUrl/rootkey/method/param1/param2/,,,
     * @method serverRequest
    */
    serverRequest(req,res)
    {
        if(this.rootKey.length>0)
        {
            if(req.method == "POST")
            {
                if(req.url.length>0)
                {
                    let arr = req.url.substring(1,req.url.length).split('/');
    
                    if(arr.length>0)
                    {
                        if(arr[0] == this.rootKey)
                        {
                            arr.splice(0,1);
                            if(arr.length>0)
                            {
                                var method = arr[0];
                                var obj    = null;

                                arr.splice(0,1);
                                
                                if(this.onPostRequest)
                                {
                                    obj = this.onPostRequest(method,arr);
                                }
    
                                if(obj)
                                {
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    res.write(JSON.stringify(obj));
                                }
                            }
                        }
                    }
                }
            }
        }
        res.end();
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
        client.remoteAddress  = client._socket.remoteAddress;
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
     * Invoked when received string message from peer, splits first char by message type and invokes message according to type
     * @method onStringMessage
     * @param {String} msg - message
     * @param {Object} client - peer reference
    */
    onStringMessage(msg,client)
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
                    if(client.failedPeers.length>0)
                    {
                        this.sendToPeers(client.failedPeers,pack);
                    }
                    break;
                }
                case MessageType.MESSAGE:
                {
                    try
                    {
                        var message = (this.encrypt) ? JSON.parse(this.decode(pack)) : JSON.parse(pack);
                        if(this.onClientMessage)
                        {
                            this.onClientMessage(client,message);
                        }
                    }
                    catch(e)
                    {
                        if(this.onRawMessage)
                        {
                            this.onRawMessage(client,msg);
                        }
                    }
                    break;
                }
                default:
                {
                    if(this.onRawMessage)
                    {
                        this.onRawMessage(client,msg);
                    }
                }
            }
        }
    }

    /**
     * Invoked when array buffer received from peer, gets last byte to check if its rtc failed package else sends it as is
     * @method onArrayBuffer
     * @param {String} msg - message
     * @param {Object} client - peer reference
    */
    onArrayBuffer(data,client)
    {
        if(client)
        {
            if(client.room)
            {
                var arr = ByteArrayUtils.bufferToArray(client.room.byteType,data);
    
                if(arr[arr.length-1] == MessageType.RTC_FAIL)
                {
                    if(client.failedPeers.length>0)
                    {
                        this.sendToPeers(client.failedPeers,data);
                    }
                }
                else
                {
                    if(this.onByteData)
                    {
                        this.onByteData(client,arr);
                    }
                }
            }
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
        if(msg instanceof ArrayBuffer)
        {
            this.onArrayBuffer(msg,client);
        }
        else
        {
            this.onStringMessage(msg,client);
        }
    }

    /**
     * Invoked when received RTC related message
     * @method onRTCMessage
     * @param {String} data   - message
     * @param {Object} client - peer reference
    */
    onRTCMessage(data,client)
    {
        try
        {
            var message = (this.encrypt) ? JSON.parse(this.decode(data)) : JSON.parse(data);

            switch(message.ev)
            {
                case InternalEvents.ICE_CANDIDATE:
                case InternalEvents.SDP_DESCRIPTION:
                {
                    var to         = message.id;
                    message.id     = client.id;
                    message.rtcId  = client.rtcId;
                    
                    this.sendToPeer(to,(this.encrypt) ? this.encode(JSON.stringify(message)) : JSON.stringify(message));
                    break;
                }
                case InternalEvents.RTC_CONNECT:
                case InternalEvents.RTC_DISCONNECT:
                {
                    this.updateFallbackList((message.ev == InternalEvents.RTC_DISCONNECT),client.id,message.id);
                    break;
                }
            }
        }
        catch(e)
        {
            if(this.onError)
            {
                this.onError(e);
            }
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
       if(this.peers[target].room && this.peers[target].room.rtcFallbackEnabled == true)
       {
           if(to)
           {
               if(Array.isArray(to))
               {
                   for(var num = 0; num < to.length; num++)
                   {
                        if(to[num]!=target)
                        {
                            if(this.peers[target].room == this.peers[to[num]].room)
                            {
                                this.addToFallbackList(target,to[num]);
                            }
                        }
                    }
                }
                else if(to!=target)
                {
                    if(this.peers[target].room == this.peers[to].room)
                    {
                        if(this.peers[to] && this.peers[to].failedPeers.indexOf(target)<0)
                        {
                            this.peers[to].failedPeers.push(target);
                            this.fallbackListUpdated(to);
                        }
                        if(this.peers[target] && this.peers[target].failedPeers.indexOf(to)<0)
                        {
                            this.peers[target].failedPeers.push(to);
                            this.fallbackListUpdated(target);
                        }
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
        if(from)
        {
            if(target!=from)
            {
                if(this.peers[target])
                {
                    if(this.peers[target].failedPeers.indexOf(from)>-1)
                    {
                        this.peers[target].failedPeers.splice(this.peers[target].failedPeers.indexOf(from),1);
                        this.fallbackListUpdated(target);
                    }
                }
                if(this.peers[from])
                {
                    if(this.peers[from].failedPeers.indexOf(target)>-1)
                    {
                        this.peers[from].failedPeers.splice(this.peers[from].failedPeers.indexOf(target),1);
                        this.fallbackListUpdated(from);
                    }
                }
            }
        }
        else
        {
            for (var key in this.peers)
            {
                if(target!=key)
                {
                    this.removeFromFallbackList(target,key);
                }
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
     * sends message with event to peer by id
     * @method sendEventToPeer
     * @param {Object} id - peer id
     * @param {String} ev - event to send
     * @param {String} data - data to send
    */
    sendEventToPeer(id,ev,data)
    {
        data = (data===undefined) ? {} : data;
        
        if(id && ev)
        {
            this.sendToPeer(id,(this.encrypt) ? this.encode(JSON.stringify({ev:ev,data:data})) : JSON.stringify({ev:ev,data:data}));
            
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
        data = (data===undefined) ? {} : data;

        if(ids && ids.length>0 && ev)
        {
            this.sendToPeers(ids,(this.encrypt) ? this.encode(JSON.stringify({ev:ev,data:data})) : JSON.stringify({ev:ev,data:data}),except);
        }
    }
    
    /**
     * broadcasts message with event to every connected peer
     * @method broadcastEvent
     * @param {String} ev - event to send
     * @param {String} data - message to send
    */
    broadcastEvent(ev,msg)
    {
        msg = (msg===undefined) ? {} : msg;

        this.broadcast((this.encrypt) ? this.encode(JSON.stringify({ev:ev,data:msg})) : JSON.stringify({ev:ev,data:msg}));
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

    /**
     * Same as btoa
     * @method encode
     * @param {String} str - string to encode
     */
    encode(str)
    {
        return new Buffer(str).toString('base64');
    }

    /**
     * Same as atob
     * @method decode
     * @param {String} str - string to decode
     */
    decode(str)
    {
        return new Buffer(str,'base64').toString('ascii');
    }
}

module.exports = ConnectaConnection;