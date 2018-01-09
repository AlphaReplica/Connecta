/**
 * net.socket decorator for receiving/sending json messages
 * sets passed socket encoding to utf8
 * when data recieved saves into buffer and checks by delimiter matching
 * 
 * several callbacks are available:
 * onError,onClose,onMessage,onMessageObject
 */
const net = require('net');

class EasySock
{
    // when created socket should be passed as argument
    constructor(socket)
    {
        this.startDelimiter = "Ʃ";
        this.endDelimiter   = "Ƶ";
        this.sock           = socket;
        this.buffer         = '';
        this.regex          = new RegExp(this.endDelimiter, "g");

        this.sock.setEncoding('utf8');
        this.sock.setNoDelay(true);

        this.sock.on('error',(err)=>
        {
            if(this.onError)
            {
                this.onError(err);
            }
        });

        this.sock.on('close',(msg)=>
        {
            if(this.onClose)
            {
                this.onClose(msg);
            }
        });

        this.sock.on('data' ,(data) => 
        {
            this.sock.pause();
            this.buffer+=data;

            if(this.buffer.length>0)
            {
                if(this.buffer[0] == this.startDelimiter && this.buffer[this.buffer.length-1]==this.endDelimiter)
                {
                    let msg     = this.buffer.replace(this.regex,"");
                    let arr     = msg.split(this.startDelimiter);
                    this.buffer = '';

                    if(this.onMessage || this.onMessageObject)
                    {
                        for(let num = 0; num < arr.length; num++)
                        {
                            if(arr[num].length>0)
                            {
                                if(arr[num]!=='[object Object]')
                                {
                                    if(this.onMessage)
                                    {
                                        this.onMessage(arr[num]);
                                    }
                                    if(this.onMessageObject)
                                    {
                                        try
                                        {
                                            if(typeof arr[num] === 'object')
                                            {
                                                this.onMessageObject(arr[num]);
                                            }
                                            else
                                            {
                                                this.onMessageObject(JSON.parse(arr[num]));
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
                                }
                            }
                        }
                    }
                }
            }
            this.sock.resume();
        });
    }

    // stringifies Object to json and sends
    sendObject(obj)
    {
        this.send(JSON.stringify(obj));
    }

    // sends string message
    send(msg)
    {
        if(this.sock)
        {
            this.sock.write(this.startDelimiter+msg+this.endDelimiter);
        }
    }

    // disposes socket
    destroy()
    {
        if(this.sock)
        {
            this.sock.removeAllListeners();
            this.sock.destroy();
            this.sock = null;
        }
    }
}

module.exports = EasySock;