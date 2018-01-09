/**
 * ConnectaExternalMaster creates server and spawns processes, acts as message broker between slave servers and as single websocket server
 * 
 * How it works:
 * - on creation TCP server created with given port and host
 * - spawns processes if params.spawnProcesses == true
 * - slave process creates websocket server and connects to master server
 * - when slave gets connected to master it will automatically run websocket server, ConnectaConnection instance
 * - it's possible to create slave server on different host and connect to master server
 */

 'use strict';
const ProcessEvents    = require('../ConnectaEnums').ProcessEvents;
const ConnectaRedirect = require('./ConnectaRedirect');
const EasySock         = require('./EasySock');
const exec             = require('child_process');
const net              = require('net');
const numCPUs          = require('os').cpus().length;

class ConnectaExternalMaster
{
    /**
    * @param {Number} port - Port to use for redirection
    * @param {Object} params - params Object, see connectaDefaultValues
    */
    constructor(port,params)
    {
        this.port        = port;
        this.params      = params;
        this.processes   = [];
        this.connections = {};
        this.peers       = {};
        this.spawnProcesses();
        this.createMasterServer();
        this.redirector = new ConnectaRedirect(this.port,this.params);
    }

    /**
     * Creates Master server for slave processes
     * @method createMasterServer
    */
    createMasterServer()
    {
        this.server = net.createServer();
        this.server.listen(this.params.masterPort);
        this.server.on('connection', (socket) =>
        {
            socket = new EasySock(socket);
            socket.onMessageObject = (msg)=>{this.onSlaveMessage     (socket,msg);};
            socket.onError         = (err)=>{this.onSlaveError       (socket,err);};
            socket.onClose         = (msg)=>{this.onSlaveDisconnected(socket);};
        });
    }

    /**
     * Invoked when slave server gets connected, sets data from slave server and registers in host redirector
     * @method onSlaveConnected
     * @param {Object} socket - server reference
     * @param {Object} data - data to set on socket reference
    */
    onSlaveConnected(socket,data)
    {
        socket.id    = data.id;
        socket.host  = data.host;
        socket.port  = data.port;
        socket.peers = data.peers;
        this.connections[data.id] = socket;
        this.redirector.registerHost(socket);
    }

    /**
     * Invoked when slave server gets disconnected, removes all register peers with disconnected process id and  unregisters in host redirector
     * @method onSlaveDisconnected
     * @param {Object} socket - server reference
    */
    onSlaveDisconnected(socket)
    {
        var id = socket.id;

        for(var num = 0; num < this.connections[id].peers.length; num++)
        {
            this.onProcessPeerDisconnected(id,this.connections[id].peers[num]);
        }
        this.connections[id].peers = [];
        
        if(this.connections[socket.id])
        {
            delete this.connections[socket.id];
        }
        this.redirector.unregisterHost(socket);
    }

    /**
     * Invoked when error happens on slave connection
     * @method onSlaveError
     * @param {Object} socket - server reference
     * @param {String} err - error string
    */
    onSlaveError(socket,err)
    {
        console.log(err);
    }
    
    /**
     * Invoked when slave message received, invokes message by type
     * @method onSlaveMessage
     * @param {Object} socket - server reference
     * @param {String} msg - message to parse
    */
    onSlaveMessage(socket,msg)
    {
        if(msg.ev)
        {
            switch(msg.ev)
            {
                case ProcessEvents.ON_CONNECTED:
                {
                    this.onSlaveConnected(socket,msg.data);
                    break;
                }
                case ProcessEvents.ON_CLIENT_CONNECTED:
                {
                    this.onProcessPeerConnected(socket.id,msg.data);
                    break;
                }
                case ProcessEvents.ON_CLIENT_DISCONNECTED:
                {
                    this.onProcessPeerDisconnected(socket.id,msg.data);
                    break;
                }
                case ProcessEvents.ON_EVENT_MESSAGE:
                {
                    if(this.onClientMessage)
                    {
                        this.onClientMessage(msg.id,msg.data);
                    }
                }
                case ProcessEvents.ON_MESSAGE_TRANSFER:
                {
                    this.sendToPeer(msg.data.id,msg.data.data);
                    break;
                }
                case ProcessEvents.ON_RTC_FAIL_UPDATE:
                {
                    if(this.addOrRemoveFailedPeers)
                    {
                        this.addOrRemoveFailedPeers(msg.data.add,msg.data.id1,msg.data.id2);
                    }
                    break;
                }
            }
        }
    }

    /**
     * Invoked when Websocket client gets connected on slave server, object created with received id and added in dictionary
     * @method onProcessPeerConnected
     * @param {Object} from - process id
     * @param {String} id - peer id
    */
    onProcessPeerConnected(from,id)
    {
        if(!this.peers[id])
        {
            this.peers[id] = {id:id,from:from,failedPeers:[]};
            this.connections[from].peers.push(id);
        }
        
        if(this.onClientConnected)
        {
            this.onClientConnected(this.peers[id]);
        }
    }
    

    /**
     * Invoked when Websocket client gets disconnected on slave server, object with received id removed from dictionary
     * @method onProcessPeerDisconnected
     * @param {Object} from - process id
     * @param {String} id - peer id
    */
    onProcessPeerDisconnected(from,id)
    {
        var peer = this.peers[id];
        
        if(peer)
        {
            var index = this.connections[from].peers.indexOf(id);

            if(index>-1)
            {
                this.connections[from].peers.splice(index,1);
            }
            delete this.peers[id];
        }

        if(this.onClientDisconnected)
        {
            this.onClientDisconnected(peer);
        }
    }

    /**
     * called when peer fallback list updated, failed peers list will be sent to slave server
     * @method fallbackListUpdated
     * @param {Object} id - peer id
     * @param {Array} data - peer ids array
    */
    fallbackListUpdated(id,data)
    {
        if(this.peers[id])
        {
            this.sendEventToSlave(this.peers[id].from,ProcessEvents.ON_RTC_FAIL_UPDATE,{id:id,data:this.peers[id].failedPeers});
        }
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
     * returns connected peers count
     * @method peersCount
    */
    peersCount()
    {
        return Object.keys(this.peers).length;
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
        var load = [];
        for (var key in this.connections)
        {
            load.push({id:key,peers:this.connections[key].peers.length});
        }
        
        return load;
    }


    /**
     * sends message to peer by id
     * @method sendToPeer
     * @param {Object} id - peer id
     * @param {String} data - data to send
    */
    sendToPeer(id,data)
    {
        if(this.peers[id] && data)
        {
            if(this.connections[this.peers[id].from])
            {
                this.sendEventToSlave(this.peers[id].from,ProcessEvents.ON_MESSAGE,{id:id,data:data});
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
     * broadcasts message to every connected peer on every connected slave server
     * @method broadcast
     * @param {String} msg - message to send
    */
    broadcast(msg)
    {
        for (var key in this.connections)
        {
            this.connections[key].send(msg);
        }
    }

    /**
     * sends event message to slave server
     * @method sendEventToSlave
     * @param {Number} id - slave server id
     * @param {String} ev - event type to send
     * @param {String} msg - message to send
    */
    sendEventToSlave(id,ev,msg)
    {
        this.sendMessageToSlave(id,{ev:ev,data:msg});
    }

    /**
     * sends message to slave server
     * @method sendMessageToSlave
     * @param {Number} id - slave server id
     * @param {String} msg - message to send
    */
    sendMessageToSlave(id,msg)
    {
        if(this.connections[id])
        {
            this.connections[id].sendObject(msg);
        }
    }

    /**
     * spawns new slave server processes
     * @method spawnProcesses
    */
    spawnProcesses()
    {
        if(this.params.spawnProcesses == true)
        {
            for(var num = 0; num < numCPUs; num++)
            {
                this.spawnProcess();
            }
        }
    }

    /**
     * spawns new slave server process
     * @method spawnProcess
    */
    spawnProcess()
    {
        if(this.params.spawnProcesses == true)
        {
            var randomPort = Math.floor(Math.random() * (65535 - this.port)) + this.port;
            var proc = exec.execFile("node",[__dirname+"/ConnectaExternalSlave.js",
                                             this.params.masterIp,
                                             this.params.masterPort,
                                             this.params.host,
                                             randomPort,
                                             this.params.key,
                                             this.params.cert,
                                             this.params.passphrase],
                                             {maxBuffer:256*1024},
                                             this.onProcessCallback);
            proc.addListener('close',()=>{this.onProcessClose();});
            this.processes.push(proc);
        }
    }

    /**
     * process callback, invoked when process has errors on any type of message
     * @method onProcessCallback
     * @param {String} err - process error
     * @param {String} data - process data
    */
    onProcessCallback(err, data)
    {
        if (err)
        {
            console.log('Process Error:',err);
        }
        if (data)
        {
            console.log('Process Info:',data);
        }
    }

    /**
     * invoked when process gets closed, new process gets created
     * @method onProcessClose
    */
    onProcessClose()
    {
        for(var num = this.processes.length-1; num>=0; num--)
        {
            if(this.processes[num].killed)
            {
                this.processes[num].removeAllListeners();
                this.processes[num] = null;
                this.processes.splice(num,1);
            }
        }
        this.spawnProcess();
    }
}

module.exports = ConnectaExternalMaster;