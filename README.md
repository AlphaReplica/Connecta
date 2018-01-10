# Connecta

Websocket server on top of uws to easily connect WebRTC Peers

<b>What it can do:</b>
- designed for realtime games, backed by webrtc for low latency and minimum server load on heave traffic apps
- Room System (create/delete) rooms
- Connects every WebRTC peer joined in same room automatically
- WebRTC failover, if client doesn't support webRTC or has problems connecting any of the peers than server will act as message broker
- autoreconnect
- horizontal scaling (In experimental stage) by running master/slave servers where master only listens to slave servers where peers are connected

<b>Example for creating and joining room, Server</b>
```
const Connecta = require('connecta');

var connecta = new Connecta.ConnectaServer(8038);

connecta.createRoom("testRoom",true,false,true,true,false);

connecta.addListener('connected',function(client)
{
    connecta.addClientToRoom(client.id,"testRoom");
});


```

<b>Example for creating and joining room, Client</b>
```
var stunServers   = ['stun.services.mozilla.com','stun.l.google.com:19302'];
var reconnectTime = 3;
var host          = 'ws://localhost:8038';

connecta = new Connecta(host,reconnectTime,stunServers);

connecta.addEventListener('connected' ,function(e)
{
	console.log("CONNECTED",e);
});

connecta.addEventListener('joinedRoom',function(e)
{
	console.log("JOINED",e);
});
```