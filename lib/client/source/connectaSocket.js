/**
 * ConnectaSocket.js
 * 
 * creates connection to server
 */

 
/**
 * @param {String} url - server url
 * @param {Number} reconnect - reconnect time in seconds
 */
var ConnectaSocket = (function(url,reconnect,encode)
{
    var scope = this;
    
    this.id;
    this.encode        = (encode === true) ? true : false;
    this.roomUsers     = [];
    this.fallbackUsers = 0;
    this.room          = "";
    this.rtcId         = 0;
    this.byteType      = 0;
    this.useRTC        = false;
    this.rtcFallback   = false;
    this._url          = url;
    this._redirectURL  = "";
    this._reconnect    = (typeof reconnect == 'number' && reconnect>0) ? reconnect : 0
    this._conn;

	// connects to server
    function connect()
    {
        if(scope._conn)
        {
            if(scope._conn.readyState === 1)
            {
                return;
            }
            scope._conn.close();
        }
        var url = (scope._redirectURL.length>0) ? scope._redirectURL : scope._url;

        scope._conn            = new WebSocket(url);
        scope._conn.binaryType = "arraybuffer";
        scope._conn.open       = onOpen;
        scope._conn.onerror    = onerror;
        scope._conn.onclose    = onClose;
        scope._conn.onmessage  = onMessage;
    }


    // 
    function onOpen(e)
    {
    }

	// server error callback
    function onerror(e)
    {
        if(scope.onError)
        {
            scope.onError(e);
        }
    }

	// close callback
    function onClose(e)
    {
        if(scope.onClose)
        {
            scope.onClose(e);
        }
        scope._redirectURL    = "";
        scope._conn.onopen    = null;
        scope._conn.onerror   = null;
        scope._conn.onclose   = null;
        scope._conn.onmessage = null;
        reconnectServer();
    }

	// server message callback, parses and invokes data by event type
    function onMessage(e)
    {
        if(e.data instanceof ArrayBuffer)
        {
            onArrayBuffer(e.data);
        }
        else
        {
            onStringMessage(e.data);
        }
    }

	// server message callback for bytebuffer message
    function onArrayBuffer(data)
    {
        var arr = bufferToArray(scope.byteType,data);
        
        if(arr)
        {
            if(arr[arr.length-1] == MessageType.RTC_FAIL && scope.rtcFallback == true && scope.useRTC == true)
            {
                if(scope.onRTCFallback)
                {
                    scope.onRTCFallback(arr[arr.length-2],arr,true);
                }
            }
            else
            {
                if(scope.onBytesMessage)
                {
                    scope.onBytesMessage(arr);
                }
            }
        }
    }

	// server message callback, parses and invokes data by event type
    function onStringMessage(data)
    {
        try
        {
            data = (scope.encode) ? JSON.parse(atob(data)) : JSON.parse(data);
        
            switch(data.ev)
            {
                case InternalEvents.REDIRECT:
                {
                    changeServer(data.data);
                    break;
                }
                case InternalEvents.CONNECTED:
                {
                    scope.id = data.data;
                    if(scope.onConnected)
                    {
                        scope.onConnected(scope.id);
                    }
                    break;
                }
                case InternalEvents.JOINED_ROOM:
                {
                    scope.roomUsers   = data.data.users;
                    scope.room        = data.data.room;
                    scope.params      = data.data.params;
                    scope.rtcId       = data.data.rtcId;
                    scope.useRTC      = data.data.useRTC;
                    scope.rtcFallback = data.data.rtcFallback;
                    scope.byteType    = data.data.byteType;

                    if(scope.onJoinedRoom)
                    {
                        scope.onJoinedRoom(scope.room,scope.params);
                    }
                    break;
                }
                case InternalEvents.ROOM_PARAMS:
                {
                    scope.params = data.data;
                    if(scope.onRoomUpdate)
                    {
                        scope.onRoomUpdate(scope.params);
                    }
                    break;
                }
                case InternalEvents.USER_JOINED_ROOM:
                {
                    if(scope.roomUsers)
                    {
                        var hasObject = false;
                        for(var num = 0; num < scope.roomUsers.length; num++)
                        {
                            if(scope.roomUsers[num].id==data.data.id)
                            {
                                hasObject = true;
                                break;
                            }
                        }
                        if(hasObject == false)
                        {
                            scope.roomUsers.push(data.data);
                        }
                    }
                    if(scope.onClientJoinedRoom)
                    {
                        scope.onClientJoinedRoom(data.data.id);
                    }
                    break;
                }
                case InternalEvents.LEFT_ROOM:
                {
                    if(scope.roomUsers)
                    {
                        scope.roomUsers = [];
                    }
                    if(scope.onLeftRoom)
                    {
                        scope.onLeftRoom();
                    }
                    break;
                }
                case InternalEvents.USER_LEFT_ROOM:
                {
                    if(scope.roomUsers)
                    {
                        for(var num = 0; num < scope.roomUsers.length; num++)
                        {
                            if(scope.roomUsers[num].id==data.data)
                            {
                                scope.roomUsers.splice(num,1);
                                break;
                            }
                        }
                    }
                    if(scope.onClientLeftRoom)
                    {
                        scope.onClientLeftRoom(data.data);
                    }
                    break;
                }
                case InternalEvents.SDP_DESCRIPTION:
                {
                    if(scope.onSDPDescription)
                    {
                        scope.onSDPDescription(data.id,data.rtcId,data.data);
                    }
                    break;
                }
                case InternalEvents.ICE_CANDIDATE:
                {
                    if(scope.onIceCandidate)
                    {
                        scope.onIceCandidate(data.id,data.data);
                    }
                    break;
                }
                case InternalEvents.RTC_FALLBACK_LIST:
                {
                    scope.fallbackUsers = data.data;
                    
                    break;
                }
                case InternalEvents.RTC_FALLBACK:
                {
                    if(scope.onRTCFallback)
                    {
                        scope.onRTCFallback(data.from,data.data,false);
                    }
                    break;
                }
                default:
                {
                    if(data.ev)
                    {
                        if(scope.onMessage)
                        {
                            scope.onMessage(data);
                        }
                    }
                    else
                    {
                        if(scope.onRawMessage)
                        {
                            scope.onRawMessage(data);
                        }
                    }
                    break;
                }
            }
        }
        catch(e)
        {
            if(scope.onRawMessage)
            {
                scope.onRawMessage(data);
            }
        }
    }
    
	// switches server by given url
    function changeServer(url)
    {
        scope._redirectURL = url;
        if(scope._conn)
        {
            scope._conn.onopen     = null;
            scope._conn.onerror    = null;
            scope._conn.onclose    = null;
            scope._conn.onmessage  = null;
            scope._conn.close();
        }
        connect();
    }

	// reconnect
    function reconnectServer()
    {
        if(scope._reconnect > 0)
        {
            setTimeout(connect,scope._reconnect * 1000);
        }
    }
    connect();
});


/**
 * sends message to server
 * @method send
 * @param {String} obj - Message to send
 * @param {Object} Prefix - Prefix to message (required to make difference on message type)
 */
ConnectaSocket.prototype.send = function(obj,prefix)
{
    if(obj)
    {
        if(this._conn)
        {
            if(this._conn.readyState === 1)
            {
                if(ArrayBuffer.isView(obj))
                {
                    this._conn.send(obj);
                }
                else
                {
                    prefix = (prefix) ? prefix : "";
                    this._conn.send(prefix+obj);
                }
            }
        }
    }
}

/**
 * sends ice to broker server 
 * @method sendICE
 * @param {String} id - message target
 * @param {String} data - rtc returned ice data string
 */
ConnectaSocket.prototype.sendICE = function(id,data)
{
    this.send((this.encode) ? btoa(JSON.stringify({ev:InternalEvents.ICE_CANDIDATE,id:id,data:data}))
                            :      JSON.stringify({ev:InternalEvents.ICE_CANDIDATE,id:id,data:data}),
                            MessageType.RTC);
}

/**
 * sends sdp description to broker server 
 * @method sendSDP
 * @param {String} id - message target
 * @param {String} data - rtc returned sdp description data string
 */
ConnectaSocket.prototype.sendSDP = function(id,data)
{
    this.send((this.encode) ? btoa(JSON.stringify({ev:InternalEvents.SDP_DESCRIPTION,id:id,data:data}))
                            :      JSON.stringify({ev:InternalEvents.SDP_DESCRIPTION,id:id,data:data}),
                            MessageType.RTC);
}

/**
 * sends rtc state to server 
 * @method sendRTCState
 * @param {Boolean} connected - is connected
 * @param {String} id - this id
 */
ConnectaSocket.prototype.sendRTCState = function(connected,id)
{
    this.send((this.encode) ? btoa(JSON.stringify({ev:(connected==true) ? InternalEvents.RTC_CONNECT : InternalEvents.RTC_DISCONNECT,id:id}))
                            :      JSON.stringify({ev:(connected==true) ? InternalEvents.RTC_CONNECT : InternalEvents.RTC_DISCONNECT,id:id}),
                            MessageType.RTC);
}

/**
 * sends message to server to send it to failed RTC users
 * @method sendFallback
 * @param {String} msg - message to send
 */
ConnectaSocket.prototype.sendFallback = function(msg)
{
    if(this.rtcFallback == true)
    {
        if(this.fallbackUsers && this.fallbackUsers>0 && msg)
        {
            if(ArrayBuffer.isView(msg))
            {
                msg[msg.length-2] = this.rtcId;
                msg[msg.length-1] = MessageType.RTC_FAIL;
                this.send(msg);
            }
            else
            {
                this.send((this.encode) ? btoa(JSON.stringify({ev:InternalEvents.RTC_FALLBACK,from:this.rtcId,data:msg}))
                                        :      JSON.stringify({ev:InternalEvents.RTC_FALLBACK,from:this.rtcId,data:msg}),MessageType.RTC_FAIL);
            }
        }
    }
}

/**
 * creates message with event type and data
 * @method sendMessage
 * @param {String} type - message event to send
 * @param {String} msg - message data to send
 */
ConnectaSocket.prototype.sendMessage = function(type,msg)
{
    if(type && msg)
    {
        this.send((this.encode) ? btoa(JSON.stringify({ev:type,data:msg})) : JSON.stringify({ev:type,data:msg}),MessageType.MESSAGE);
    }
}

/**
 * closes connection and prevents reconnect
 * @method close
 */
ConnectaSocket.prototype.close = function()
{
    this._reconnect = 0;
    if(this._conn)
    {
        if(this._conn.readyState === 1)
        {
            this._conn.close();
            this._conn = null;
        }
    }
}

/**
 * disposes connection object
 * @method dispose
 */
ConnectaSocket.prototype.dispose = function()
{
    if(this._conn)
    {
        this._reconnect      = 0;
        this.id              = null;
        this._url            = null;
        this._conn.onopen    = null;
        this._conn.onerror   = null;
        this._conn.onclose   = null;
        this._conn.onmessage = null;
        this.close();
    }
}

if(typeof module != 'undefined')
{
    if(module.exports)
    {
        module.exports.ConnectaSocket = ConnectaSocket;
    }
}