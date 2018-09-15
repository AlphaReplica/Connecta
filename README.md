# Connecta

Websocket server on top of uws to easily connect WebRTC Peers

<b>What it can do:</b>
- designed for realtime games, backed by webrtc for low latency and minimum server load on heavy traffic apps
- Room System (create/delete) rooms
- Connects every WebRTC peer joined in same room automatically
- WebRTC failover, if client doesn't support webRTC or has problems connecting any of the peers than server will act as message broker
- autoreconnect

<b>Whats updated in 0.3.0:</b>
Fixed OnBeforeDisconnect and OnDisconnect events,
now onBeforeDisconnect is dispatched before disconnect routine starts
onDisconnect is dispatched after peer is removed from peer list and every disconnect routine is done

<b>Whats updated in 0.2.9:</b>
Because of UWS author desided to deprecate project added WS module for fallback
by default when installing connecta it will install uws 10.148.1 but if some problems arise it will fall back to ws module

<b>Whats updated in 0.2.8:</b>
- Added OnJoined and onLeft Callbacks in Room

<b>Whats updated in 0.2.7:</b>
- fixed join room bugs
- fixed bytearray length bug
- added shortcut methods in ConnectaRoom
- added post requests on active server

<b>Whats updated in 0.2.6:</b>
- fixed ssl incorrect key param assign
- added bytearray messaging as for webrtc and as webrtc failover 
  - you optionally can pass array type enum argument when creating room but default is Int16Array
  - you should create bytearray with connectaInstance.createArray(arraylength) after joining room
- added base64 event encoding
- removed experimental horizontal scaling, will be added in future versions as independent project

<b>Experimental horizontal scaling removed in 0.2.5</b>


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

for more detailed example see: <a href='https://github.com/AlphaReplica/Connecta-Simple-Example'>Simple Chat Example</a>