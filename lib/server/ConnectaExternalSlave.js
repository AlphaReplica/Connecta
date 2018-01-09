/**
 * ConnectaExternalSlave runs as process that creates websocket server after connecting to master
 * It's possible to create slave server on different host and connect to master server
 */

'use strict';
const ProcessEvents         = require('../ConnectaEnums').ProcessEvents;
const ConnectaConnection    = require('./ConnectaConnection');
const ConnectaDefaultValues = require('./ConnectaDefaultValues');
const EasySock              = require('./EasySock');
const net                   = require('net');
const exec                  = require('child_process');
const numCPUs               = require('os').cpus().length;

class ConnectaExternalSlave
{
    /**
     * Connects webserver instance
     * @param {Object} params - params Object, see connectaDefaultValues
     */
    constructor(params)
    {
        this.params = ConnectaDefaultValues.validateValues(params);
        this.conn   = new ConnectaConnection(params.port,params,false);
        this.conn.onClientConnected      = (obj        )=>{this.onPeerConnected                  (obj);}
        this.conn.onClientDisconnected   = (obj        )=>{this.onPeerDisconnected               (obj);}
        this.conn.onClientMessage        = (obj        )=>{this.onPeerMessage                    (obj);}
        this.conn.noPeerIdFound          = (id,obj     )=>{this.transferMessageToMaster       (id,obj);}
        this.conn.addOrRemoveFailedPeers = (add,id1,id2)=>{this.updateFailedPeersToMaster(add,id1,id2);}
        this.connectToMasterServer(this.params);
    }


    /**
     * Connects to master server, after connection starts websocket server and sends master server slave process info, process id, host and port
     * @method connectToMasterServer
    */
    connectToMasterServer()
    {
        this.socket = new EasySock(new net.Socket());
        
        this.socket.sock.connect(this.params.masterPort, this.params.masterIp);
        this.socket.sock.on('connect', ()=>
        {
            this.conn.startServer();
            this.sendEventToMaster(ProcessEvents.ON_CONNECTED,{id:process.pid,host:this.params.host,port:this.params.port,peers:this.conn.peersList()});
        });
        this.socket.onMessageObject = (msg)=>{this.onMasterMessage         (msg);};
        this.socket.onError         = (err)=>{this.onMasterError           (err);};
        this.socket.onClose         = (msg)=>{this.onDisconnectedFromMaster();};
    }


    /**
     * Invoked when slave server gets disconnected,
     * @method onDisconnectedFromMaster
    */
    onDisconnectedFromMaster()
    {
        this.conn.stopServer();
        
        if(this.socket)
        {
            this.socket.destroy();
            this.socket = null;
        }
        this.connectToMasterServer();
    }
    
    /**
     * Invoked when error happens on master/slave connection
     * @method onMasterError
     * @param {String} err - error string
    */
    onMasterError(err)
    {
        console.log(err);
    }

    /**
     * Invoked when message received from master server, invokes message by event type
     * @method onMasterMessage
     * @param {String} msg - message to parse
    */
    onMasterMessage(msg)
    {
        switch(msg.ev)
        {
            case ProcessEvents.ON_MESSAGE:
            {
                this.conn.sendToPeer(msg.data.id,msg.data.data);
                break;
            }
            case ProcessEvents.ON_RTC_FAIL_UPDATE:
            {
                this.conn.fallbackListUpdated(msg.data.id,msg.data.data);
                break;
            }
            case ProcessEvents.BROADCAST_MESSAGE:
            {
                this.conn.broadcast(msg.data);
            }
        }
    }

    /**
     * sends event message to master server
     * @method sendEventToMaster
     * @param {String} ev - event type to send
     * @param {String} msg - message to send
    */
    sendEventToMaster(ev,msg)
    {
        this.sendMessageToMaster({ev:ev,data:msg});
    }
    
    /**
     * sends message to master server
     * @method sendMessageToMaster
     * @param {String} msg - message to send
    */
    sendMessageToMaster(msg)
    {
        if(this.socket)
        {
            this.socket.sendObject(msg);
        }
    }

    /**
     * Invoked when Websocket client gets connected
     * @method onProcessPeerConnected
     * @param {Object} obj - peer reference
    */
    onPeerConnected(obj)
    {
        this.sendEventToMaster(ProcessEvents.ON_CLIENT_CONNECTED,obj.id);
    }

    /**
     * Invoked when Websocket client gets disconnected
     * @method onProcessPeerConnected
     * @param {Object} obj - peer reference
    */
    onPeerDisconnected(obj)
    {
        this.sendEventToMaster(ProcessEvents.ON_CLIENT_DISCONNECTED,obj.id);
    }

    /**
     * Invoked when received message from peer
     * @method onPeerMessage
     * @param {Object} obj - message
    */
    onPeerMessage(obj)
    {
        this.sendEventToMaster(ProcessEvents.ON_EVENT_MESSAGE,{id:obj.id,data:obj});
    }

    /**
     * Transfers message to master targeting peer with id
     * @method transferMessageToMaster
     * @param {String} id - Peer Id
     * @param {String} obj - message
    */
    transferMessageToMaster(id,obj)
    {
        this.sendEventToMaster(ProcessEvents.ON_MESSAGE_TRANSFER,{id,id,data:obj});
    }

    /**
     * Sends request to master server to update failed peers list to given peer id
     * @method updateFailedPeersToMaster
     * @param {Boolean} add - add/remove
     * @param {String} id1 - Peer 1 Id
     * @param {String} id2 - Peer 2 Id
    */
    updateFailedPeersToMaster(add,id1,id2)
    {
        this.sendEventToMaster(ProcessEvents.ON_RTC_FAIL_UPDATE,{add:add,id1:id1,id2:id2});
    }
}


module.exports = ConnectaExternalSlave;

// params passed
// 0 MasterHost
// 1 MasterPort
// 2 Host
// 3 Port
// 4 sslKey
// 5 sslCert
// 6 sslPassword

var args   = process.argv.slice(2);
var params = {};
if(args.length>0){params.masterIp   = args[0];}
if(args.length>1){params.masterPort = args[1];}
if(args.length>2){params.host       = args[2];}
if(args.length>3){params.port       = args[3];}
if(args.length>4){params.key        = args[4];}
if(args.length>5){params.cert       = args[5];}
if(args.length>6){params.passphrase = args[6];}

console.log("PROCESS:",process.pid, "ARGS:",args);

new ConnectaExternalSlave(params);