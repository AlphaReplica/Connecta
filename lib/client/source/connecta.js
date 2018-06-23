/**
 * Connecta.js
 * 
 * creates connection to server, connects peers and sends/receives data
 * it requieres shim WebRTC adapter to work properly on all browsers https://github.com/webrtc/adapter
 */

 /**
 * @param {String} url       - websocket server url
 * @param {Number} reconnect - reconnect interval in seconds
 * @param {Array}  stunUrls  - array of stun urls
 */
var Connecta = (function(url,reconnect,stunUrls,encodeToBase64)
{
    var scope = this;

    this.id;
    this.room;
    this._encode    = encodeToBase64;
    this._url       = url;
    this._reconnect = (reconnect) ? reconnect : 3; 
    this._servConn;
    this._listeners = {};
    this.peers      = {};
    this.localStream;
    
	// init acts as constructor
    function init()
    {
        scope._servConn = new ConnectaSocket(scope._url,scope._reconnect,scope._encode);
        scope._servConn.onConnected = function(e)
        {
            scope.id = e;
            scope.dispatchEvent("connected");
        }
        scope._servConn.onError   = function(e)
        {
            scope.dispatchEvent("error",e);
        }
        scope._servConn.onClose = function(e)
        {
            scope.dispatchEvent("close");
            scope.closePeers();
        }

        scope._servConn.onJoinedRoom	   = onJoinedRoom;
        scope._servConn.onClientJoinedRoom = onClientJoinedRoom;
        scope._servConn.onLeftRoom         = onLeftRoom;
        scope._servConn.onClientLeftRoom   = onClientLeftRoom;
        scope._servConn.onSDPDescription   = onSDPDescription;
        scope._servConn.onIceCandidate     = onIceCandidate;
        scope._servConn.onRTCFallback      = onRTCFallback;
        scope._servConn.onMessage          = onServerMessage;
        scope._servConn.onBytesMessage     = onServerByteArray;

        window.addEventListener("beforeunload", function (event) 
        {
            scope.dispose();
        });
    }
    
	// creates ConnectaPeer Instance and returns
    function createPeerInstance(id)
    {
        var peer              = new ConnectaPeer(id,stunUrls);
        peer.onIceCandidate   = gotIceCandidate;
        peer.onDescription    = createdDescription;
        peer.onRemoteStream   = gotRemoteStream;
        peer.onConnected      = onPeerConnected;
        peer.onMessage        = onPeerMessage;
        peer.onBytesMessage   = onBytesMessage;
        peer.onConnectionFail = onPeerFailed;
        peer.onClosed         = onPeerClose;
        peer.onError          = onPeerError;
        peer.onChannelState   = onPeerState;
        scope.peers[id]       = peer;
        
        peer.init();

        return peer;
    }
    
	// gets ConnectaPeer instance by id
    function getPeer(id)
    {
        if(scope.peers[id])
        {
            return scope.peers[id];
        }
        return null;
    }
    
	// gets ConnectaPeer instance by rtcId
    function getPeerByRTCId(id)
    {
        for(var num = 0; num < scope._servConn.roomUsers.length; num++)
        {
            if(scope._servConn.roomUsers[num].rtcId == id)
            {
                return scope._servConn.roomUsers[num];
            }
        }
        return null;
    }
    
	// gets ConnectaPeer instance by id, if not exists, creates new and returns
    function getOrCreatePeer(id)
    {
        if(scope.peers[id])
        {
            return scope.peers[id];
        }
        return createPeerInstance(id);
    }

	// called when joined in room
    function onJoinedRoom(id,props)
    {
        scope.dispatchEvent("joinedRoom",{id:id,props:props});
    }
	
	// called when client joined in room, if rtc enabled and browser has support of rtc, creates offer and sends to peer by sending sdp string to server, else notifies server to add connection in fallback list
    function onClientJoinedRoom(id)
    {
        if(scope._servConn.useRTC)
        {
            if(scope.hasWebRTCSupport())
            {
                var peer = getOrCreatePeer(id);
                peer.createOffer();
            }
            else
            {
                scope._servConn.sendRTCState(false,id);
            }
        }
        scope.dispatchEvent("clientJoinedRoom",id);
    }

    // invoked when server notifies client removing from room, all active peers being closed
    function onLeftRoom()
    {
        scope.closePeers();
        scope.dispatchEvent("leftRoom",id);
    }

	// called when client leaves room, peer with client id will be removed
    function onClientLeftRoom(id)
    {
        scope.removePeer(getPeer(id));
        scope.dispatchEvent("clientLeftRoom",id);
    }

	// invoked when fallback message is received
    function onRTCFallback(from,data,isArray)
    {
        var peer = getPeerByRTCId(from);
        
        if(peer)
        {
            if(isArray == true)
            {
                data = sliceArray(data,0,data.length-2);// data.slice(0,data.length-2);
            }
            scope.dispatchEvent("peerMessage",{message:data,id:peer.id,rtc:peer.rtcId,array:isArray,fallback:true});
        }
    }

	// invoked when server bytearray received
    function onServerByteArray(arr)
    {
        scope.dispatchEvent("onByteArray",arr);
    }

	// invoked when server message received
    function onServerMessage(data)
    {
        if(data.ev)
        {
            scope.dispatchEvent("onServerMessage",data);
            scope.dispatchEvent(data.ev,data);
        }
    }
	
	// invoked when remove stream video/audio received
    function gotRemoteStream(stream)
    {
        scope.dispatchEvent("remoteStream",stream);
    }

	// invoked when peer datachanel is opened
    function onPeerState(peer,state)
    {
        if(state == "open")
        {
            scope.dispatchEvent("connectedToPeer",peer);
        }
    }

	// invoked when peer connection, notifies server and resends offser if stream is enabled
    function onPeerConnected(peer)
    {
        if(scope.localStream)
        {
            peer.updateStream(scope.localStream,false);
        }
        scope._servConn.sendRTCState(true,peer.id);

        scope.dispatchEvent("peerConnected",peer.id);
    }

	// invoked when peer fails to connect
    function onPeerFailed(peer)
    {
        scope._servConn.sendRTCState(false,peer.id);
        scope.dispatchEvent("peerFailed",peer.id);
    }
    
	// invoked when peer closes, this will remove peer from dictionary
    function onPeerClose(peer)
    {
        var id = peer.id;
        scope.removePeer(peer);
        sendPeerClose(id);

        scope.dispatchEvent("peerDisconnected",id);
    }
    
	// sends server false state to add connection as fallback list
    function sendPeerClose(id)
    {
        scope._servConn.sendRTCState(false,id);
    }
    
	// invoked when peer creates sdp description and it's ready to send
    function createdDescription(peer,data)
    {
        scope._servConn.sendSDP(peer.id,data);
    }

	// invoked when received sdp offer/answer from server
    function onSDPDescription(id,rtcId,data)
    {
        if(scope._servConn.useRTC)
        {
            if(scope.hasWebRTCSupport())
            {
                var peer   = getOrCreatePeer(id);
                peer.rtcId = rtcId;
                peer.onServerMessage(JSON.parse(data));
            }
            else
            {
                scope._servConn.sendRTCState(false,id);
            }
        }
    }
    
	// invoked when received ice from server
    function gotIceCandidate(peer,data)
    {
        scope._servConn.sendICE(peer.id,data);
    }

	// invoked when peer creates ice candidate and it's ready to send
    function onIceCandidate(id,data)
    {
        if(scope.hasWebRTCSupport())
        {
            getOrCreatePeer(id).onServerMessage(JSON.parse(data));
        }
    }

	// invoked when string message received from peer
    function onPeerMessage(peer,msg)
    {
        scope.dispatchEvent("peerMessage",{message:msg,id:peer.id,rtc:peer.rtcId,array:false,fallback:false});
    }

    // invoked when byte message received from peer
    function onBytesMessage(peer,data)
    {
        var arr = bufferToArray(scope._servConn.byteType,data);

        if(arr)
        {
            if(scope._servConn.rtcFallback == true)
            {
                arr = arr.slice(0,arr.length-2);
            }
            scope.dispatchEvent("peerMessage",{message:arr,id:peer.id,rtc:peer.rtcId,array:true,fallback:false});
        }
    }

	// invoked on connectaPeer error
    function onPeerError(e)
    {
        scope.dispatchEvent("error",e);
    }

	// has MediaStream support getter
    this.hasMediaSupport = function()
    {
        return (window['MediaStream']);
    }

	// has WebRTC support getter
    this.hasWebRTCSupport = function()
    {
        return (window['RTCPeerConnection']);
    }

    init();
});

/**
 * removes peer from dictionary
 * @method removePeer
 * @param {ConnectaPeer} peer - Peer to remove
 */
Connecta.prototype.removePeer = function(peer)
{
    if(peer)
    {
        if(this.peers[peer.id])
        {
            this.peers[peer.id].onIceCandidate   = null;
            this.peers[peer.id].onDescription    = null;
            this.peers[peer.id].onRemoteStream   = null;
            this.peers[peer.id].onConnected      = null;
            this.peers[peer.id].onMessage        = null;
            this.peers[peer.id].onBytesMessage   = null;
            this.peers[peer.id].onConnectionFail = null;
            this.peers[peer.id].onClosed         = null;
            this.peers[peer.id].onError          = null;
            this.peers[peer.id].onChannelState   = null;

            delete this.peers[peer.id];
        }
        peer.dispose();
        peer = null;
    }
}

/**
 * removes all peers and clears dictionary
 * @method closePeers
 */
Connecta.prototype.closePeers = function()
{
    for (var key in this.peers)
    {
        this.removePeer(this.peers[key]);
    }
}

/**
 * sends message to connected and failed peers
 * connected peers will receive message directly, failed peers will receive message from fallback server
 * @method sendToPeers
 * @param {string} msg - Message to send
 */
Connecta.prototype.sendToPeers = function(msg)
{
    for (var key in this.peers)
    {
        if(this.peers[key].send)
        {
            this.peers[key].send(msg);
        }
    }
    this._servConn.sendFallback(msg);
}

/**
 * sends message to peer
 * @method sendMessage
 * @param {Object} type - Event to send
 * @param {Object} msg - Message to send
 */
Connecta.prototype.sendMessageToPeers = function(type,msg)
{
    var data = MessageType.MESSAGE+JSON.stringify({ev:type,data:msg});
    for (var key in this.peers)
    {
        if(this.peers[key].send)
        {
            this.peers[key].send(data);
        }
    }
    this._servConn.sendFallback(data);
}

/**
 * sends message to server
 * @method sendMessage
 * @param {Object} msg - Message to send
 */
Connecta.prototype.send = function(msg)
{
    this._servConn.send(msg);
}

/**
 * sends message to server
 * @method sendMessage
 * @param {Object} type - Event to send
 * @param {Object} msg - Message to send
 */
Connecta.prototype.sendMessage = function(type,msg)
{
    this._servConn.sendMessage(type,msg);
}

/**
 * creates typed array by room type
 * @method createArray
 * @param {int} size - size of array
 */
Connecta.prototype.createArray = function(size)
{
    var arr = createTypedArray(this._servConn.byteType,size+((this._servConn.useRTC == true && this._servConn.rtcFallback == true) ? 2 : 0));
    arr[arr.length-2] = this._servConn.rtcId;
    return arr;
}
/**
 * enables media video/audio, requires HTTPS
 * @method enableMedia
 * @param {Boolean} video - true == enable
 * @param {Boolean} audio - true == enable
 */
Connecta.prototype.enableMedia = function(video,audio)
{
    video = (video) ? video : false;
    audio = (audio) ? audio : false;

    if(video || audio == true)
    {
        var scope = this;
        scope.disableMedia(true,true,false);
        if(navigator.mediaDevices)
        {
            navigator.mediaDevices.getUserMedia({audio:audio, video:video})
            .then(function(stream)
            {
                scope.localStream = stream;
				scope.dispatchEvent("localStream",stream);
    
                for (var key in scope.peers)
                {
                    scope.peers[key].updateStream(scope.localStream);
                }
            })
            .catch(function(e)
            {
				scope.dispatchEvent("error",e);
            });
        }
    }
}

/**
 * disables media video/audio and resends offer by updated media stream
 * @method disableMedia
 * @param {Boolean} removeVideo - true == remove
 * @param {Boolean} removeAudio - true == remove
 * @param {Boolean} notifyPeers - true == notify
 */
Connecta.prototype.disableMedia = function(removeVideo,removeAudio,notifyPeers)
{
    removeVideo = (removeVideo) ? removeVideo : true;
    removeVideo = (removeVideo) ? removeVideo : true;
    notifyPeers = (notifyPeers) ? notifyPeers : true;

    if(this.localStream)
    {
        var scope = this;
        if(removeAudio == true)
        {
            var tracks = scope.localStream.getAudioTracks();

            if(tracks.length>0)
            {
                for(var num = tracks.length-1; num >= 0; num--)
                {
                    scope.localStream.removeTrack(tracks[num]); tracks[num].stop();
                }
            }
        }
        if(removeVideo == true)
        {
            var tracks = scope.localStream.getVideoTracks();

            if(tracks.length>0)
            {
                for(var num = tracks.length-1; num >= 0; num--)
                {
                    scope.localStream.removeTrack(tracks[num]); tracks[num].stop();
                }
            }
        }
        if(scope.localStream.getTracks().length==0)
        {
            scope.localStream = null;
        }

        if(notifyPeers == true)
        {
            for (var key in peers)
            {
                peers[key].updateStream();
            }
        }
    }
}

/**
 * same as event emmiter's addEventListener but more simpler version
 * @method addEventListener
 * @param {String} type - event name
 * @param {Function} callback - function to call
 */
Connecta.prototype.addEventListener = function(type, callback)
{
    if (!this._listeners[type]) 
    {
      this._listeners[type] = [];
    }
    this._listeners[type].push(callback);
};

/**
 * same as event emmiter's removeEventListener but more simpler version
 * @method removeEventListener
 * @param {String} type - event name
 * @param {Function} callback - function to call
 */
Connecta.prototype.removeEventListener = function(type, callback)
{
    if (this._listeners[type]) 
    {
        for (var num = this._listeners[type].length - 1; num >= 0; num--)
        {
            if (this._listeners[type][num] === callback)
            {
                this._listeners[type].splice(num, 1);
                return;
            }
        }
    }
};

/**
 * removes all listeners by type
 * @method removeListeners
 * @param {String} type - event name
 */
Connecta.prototype.removeListeners = function(type)
{
    if(this._listeners[type])
    {
        this._listeners[type] = [];
        delete this._listeners[type];
    }
}

/**
 * dispatches event by type and sends object as param
 * @method dispatchEvent
 * @param {String} type - event name
 * @param {Object} obj - param object
 */
Connecta.prototype.dispatchEvent = function(type,obj)
{
    if (this._listeners[type])
    {
        for (var num = 0; num < this._listeners[type].length; num++)
        {
            this._listeners[type][num].call(this,obj);
        }
    }
};

/**
 * dispose connecta object
 * @method dispose
 */
Connecta.prototype.dispose = function()
{
    this.closePeers();
    this.disableMedia(true,true,false);
    this._servConn.dispose();
    this.removeListeners();
    this.id          = null;
    this.room        = null;
    this._url        = null;
    this._reconnect  = 0; 
    this._servConn   = null;
    this._listeners  = null;
    this.peers       = null;
    this.localStream = null;
}

/**
 * returns peer's RTC id in room
 * @method peerRTCId
 */
Connecta.prototype.peerRTCId = function()
{
    if(this._servConn)
    {
        return this._servConn.rtcId;
    }
    return -1;
}

if(typeof module != 'undefined')
{
    if(module.exports)
    {
        module.exports.Connecta = Connecta;
    }
}