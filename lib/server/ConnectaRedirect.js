/**
 * ConnectaRedirect gets least loaded server and redirects connection
 */

'use strict';
const https          = require('https');
const WebSocket      = require('uws');
const InternalEvents = require('../ConnectaEnums').InternalEvents;

class ConnectaRedirect
{
    /**
    * @param {Number} port - Port to use
    * @param {Object} params - params Object, see connectaDefaultValues
    */
    constructor(port,params)
    {
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
        this.startServer();
    }

    /**
     * Starts webserver by config params, when peer connects, server sends least loaded server url, after this client disconnects and connects to given url
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
        this.server.on('connection', (client)=>
        {
            var url = this.socketUrl(); 
            
            if(url.length>0)
            {
                if(client.readyState === WebSocket.OPEN)
                {
                    client.send(JSON.stringify({ev:InternalEvents.REDIRECT,data:url}));
                    setTimeout(()=>
                    {
                        if(client)
                        {
                            client.close();
                            client = null;
                        }
                    },1000);
                }
            }
            else
            {
                client.close();
                client == null;
            }
        });
    }

    /**
     * Returns least loaded server url
     * @method socketUrl
    */
    socketUrl()
    {
        var index = -1;
        var small =  0;

        if(this.hosts)
        {
            if(this.hosts.length>0)
            {
                small = this.hosts[0].peers.length;
                for(var num = 0; num < this.hosts.length; num++)
                {
                    if(this.hosts[num].peers.length<=small)
                    {
                        small = this.hosts[num].peers.length;
                        index = num;
                    }
                }
            }
        }
        if(index>-1)
        {
            return 'ws://'+this.hosts[index].host+':'+this.hosts[index].port;
        }

        return '';
    }

    /**
     * Registers host (slave server)
     * @method registerHost
     * @param {Object} obj - server data
    */
    registerHost(obj)
    {
        if(!this.hosts)
        {
            this.hosts = [];
        }
        if(this.hosts.indexOf(obj)==-1)
        {
            this.hosts.push(obj);
        }
    }

    /**
     * Unregisters host (slave server)
     * @method unregisterHost
     * @param {Object} obj - server data
    */
    unregisterHost(obj)
    {
        if(!this.hosts)
        {
            this.hosts = [];
        }

        if(this.hosts.indexOf(obj)>-1)
        {
            this.hosts.splice(this.hosts.indexOf(obj),1);
        }
    }
}

module.exports = ConnectaRedirect;