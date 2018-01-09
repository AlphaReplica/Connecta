/**
 * ConnectaPeer.js
 * 
 * creates connection to peer and sends/recieves data
 */

/**
 * @param {String} id - peer id
 * @param {Array} obj - Array of stun server urls
 */
var ConnectaPeer = (function(id,stunServers)
{
    var scope      = this;
    var connConfig = {'iceServers': []};
    scope.id       = id;
    scope.type     = "";
    scope._conn;
    scope._data;

    scope.remoteStream;

    // parses stun server array and returns rtc friendly object
    function setIceServers()
    {
        if(stunServers)
        {
            for(var num = 0; num < stunServers.length; num++)
            {
                connConfig['iceServers'].push({'urls':'stun:'+stunServers[num]});   
            }
        }
    }

    // callback for ice candidate
    function iceCandidateCallback(e)
    {
        if(e.candidate != null)
        {
            if(scope.onIceCandidate)
            {
                scope.onIceCandidate(scope,JSON.stringify({'ice': e.candidate}));
            }
        }
    }

    // sdp offer/answer description callback
    function createdDescriptionCallback(description)
    {
        scope._conn.setLocalDescription(description)
        .then(function()
        {
            if(scope.onDescription)
            {
                scope.onDescription(scope,JSON.stringify({'sdp': scope._conn.localDescription}));
            }
        })
        .catch(onErrorCallback);
    }
    
    // called when ice connection state is changed
    function onStateChange(e)
    {
        if(scope._conn)
        {
            if(scope._conn.iceConnectionState == "connected")
            {
                if(scope.onConnected)
                {
                    scope.onConnected(scope);
                }
            }
            if(scope._conn.iceConnectionState == "failed" || scope._conn.iceConnectionState == "disconnected")
            {
                if(scope.onConnectionFail)
                {
                    scope.onConnectionFail(scope);
                }
                if(scope.type == "offer")
                {
                    scope.createOffer();
                }
            }
            if(scope._conn.iceConnectionState == "closed")
            {
                if(scope.onClosed)
                {
                    scope.onClosed(scope);
                }
                scope.dispose();
            }
        }
    }

    // ice connection error callback
    function onErrorCallback(e)
    {
        if(scope.onError)
        {
            scope.onError(e);
        }
    }

    // called when remote stream is connected
    function remoteStreamCallback(e) 
    {
        scope.remoteStream = e.stream;
        if(scope.onRemoteStream)
        {
            scope.onRemoteStream(scope.remoteStream);
        }
    }

    // called when datachannel event is invoked, also called manually from offer to create new datachannel
    function ondatachannel(e)
    {
        if(e)
        {
            scope._data = e.channel;
        }
        else
        {
            scope._data = scope._conn.createDataChannel("data");
        }

        scope._data.onopen = function()
        {
            if(scope.onChannelState)
            {
                scope.onChannelState('open');
            }
        };
        scope._data.onmessage = function(e)
        {
            if(scope.onMessage)
            {
                scope.onMessage(scope,e.data);
            }
        }
        
        scope._data.onclose = function(e)
        {
            if(scope.onChannelState)
            {
                scope.onChannelState('closed');
            }
        }
        scope._data.onerror = function(e)
        {
            if(scope.onError)
            {
                scope.onError(e);
            }
        }
    }
    
    // creates offer request, setting hasMedia to true will enable media streaming
    this.createOffer = function(hasMedia)
    {
        hasMedia = (hasMedia) ? hasMedia : false;
        if(scope._conn)
        {
            ondatachannel();
            scope.type = "offer";
            scope._conn.createOffer({RtpDataChannels: true, iceRestart:true, offerToReceiveAudio: hasMedia, offerToReceiveVideo: hasMedia}).then(createdDescriptionCallback).catch(onErrorCallback);
        }
    }

    // called by message broker server
    this.onServerMessage = function(signal)
    {
        if(scope._conn)
        {
            if(signal.sdp)
            {
                scope._conn.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                .then(function()
                {
                    if(signal.sdp.type == 'offer')
                    {
                        scope.type = "answer";
                        scope._conn.createAnswer().then(createdDescriptionCallback).catch(onErrorCallback);
                    }
                })
                .catch(onErrorCallback);
            }
            if(signal.ice)
            {
                scope._conn.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(onErrorCallback);
            }
        }
    }

    // function acts as constructor, creates and sets callbacks
    this.init = function()
    {
        setIceServers();
        if(!scope._conn)
        {
            try
            {
                scope._conn                            = new RTCPeerConnection(connConfig);
                scope._conn.onicecandidate             = iceCandidateCallback;
                scope._conn.onaddstream                = remoteStreamCallback;
                scope._conn.oniceconnectionstatechange = onStateChange;
                scope._conn.ondatachannel              = ondatachannel;
                scope._conn.streamTracks               = [];
            }
            catch(exception)
            {
                if(scope.onClosed)
                {
                    scope.onClosed(scope);
                }
            }
        }
    }
});


/**
 * Sends string message
 * @method send
 * @param {String} msg - Message to send
 */
ConnectaPeer.prototype.send = function(msg)
{
    if(this._data && this._data.readyState == "open")
    {
        this._data.send(msg);
    }
}

/**
 * adds/removes video/audio stream, this functionality requires secure connection!
 * @method updateStream
 * @param {String} msg - Message to send
 */
ConnectaPeer.prototype.updateStream = function(stream,resendOffer)
{
    var scope = this;
    resendOffer = (resendOffer) ? resendOffer : true;
    if(scope._conn)
    {
        if(scope._conn.streamTracks.length>0)
        {
            var tracks = scope._conn.streamTracks;
            
            if(tracks.length>0)
            {
                for(var num = tracks.length-1; num >= 0; num--)
                {
                    scope._conn.removeTrack(tracks[num]);
                }
            }
            scope._conn.streamTracks = [];
        }
        if(stream)
        {
            var arr = stream.getTracks();
            for(var num = 0; num < arr.length; num++)
            {
                scope._conn.streamTracks.push(scope._conn.addTrack(arr[num],stream));
            }
        }

        if(resendOffer == true)
        {
            scope.createOffer(scope._conn.streamTracks.length>0);
        }
    }
}

/**
 * returns if connected to peer
 * @method isConnected
 * @return {Boolean} connected
 */
ConnectaPeer.prototype.isConnected = function()
{
    if(this._conn)
    {
        if(this._conn.iceConnectionState == 'connected' || this._conn.iceConnectionState == 'completed')
        {
            return true;
        }
    }
    return false;
}

/**
 * disposes object
 * @method dispose
 */
ConnectaPeer.prototype.dispose = function()
{
    var scope = this;
    if(scope.remoteStream)
    {
        var tracks = scope.remoteStream.getTracks();
        
        if(tracks.length>0)
        {
            for(var num = tracks.length-1; num >= 0; num--)
            {
                scope.remoteStream.removeTrack(tracks[num]); tracks[num].stop();
            }
        }
    }
    if(scope._data)
    {
        scope._data.onmessage = null;
        scope._data.close();
    }
    if(scope._conn)
    {
        if(scope._conn.iceConnectionState != "closed")
        {
            if(scope._conn.streamTracks.length>0)
            {
                var tracks = scope._conn.streamTracks;
                
                if(tracks.length>0)
                {
                    for(var num = tracks.length-1; num >= 0; num--)
                    {
                        scope._conn.removeTrack(tracks[num]);
                    }
                }
            }
            scope._conn.onicecandidate             = null;
            scope._conn.onaddstream                = null;
            scope._conn.oniceconnectionstatechange = null;
            scope._conn.ondatachannel              = null;
            scope._conn.close();
        }
    }
    scope._conn        = null;
    scope._data        = null;
    scope.remoteStream = null;
}