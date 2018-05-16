'use strict';

var ByteType = 
{
    None:0,
    Int8Array:1,
    Uint8Array:2,
    Int16Array:3,
    Uint16Array:4,
    Int32Array:5,
    Uint32Array:6,
    Float32Array:7,
    Float64Array:8
}

var createTypedArray = function(type,size)
{
    var arr = null;
    switch(type)
    {
        case ByteType.Int8Array   :{ arr = new Int8Array   (size); break;}
        case ByteType.Uint8Array  :{ arr = new Uint8Array  (size); break;}
        case ByteType.Int16Array  :{ arr = new Int16Array  (size); break;}
        case ByteType.Uint16Array :{ arr = new Uint16Array (size); break;}
        case ByteType.Int32Array  :{ arr = new Int32Array  (size); break;}
        case ByteType.Uint32Array :{ arr = new Uint32Array (size); break;}
        case ByteType.Float32Array:{ arr = new Float32Array(size); break;}
        case ByteType.Float64Array:{ arr = new Float64Array(size); break;}
    }
    return arr;
}

var bufferToArray = function(type,data)
{
    var arr = null;
    switch(type)
    {
        case ByteType.Int8Array   :{ arr = new Int8Array   (data.slice(0,data.byteLength)); break;}
        case ByteType.Uint8Array  :{ arr = new Uint8Array  (data.slice(0,data.byteLength)); break;}
        case ByteType.Int16Array  :{ arr = new Int16Array  (data.slice(0,data.byteLength)); break;}
        case ByteType.Uint16Array :{ arr = new Uint16Array (data.slice(0,data.byteLength)); break;}
        case ByteType.Int32Array  :{ arr = new Int32Array  (data.slice(0,data.byteLength)); break;}
        case ByteType.Uint32Array :{ arr = new Uint32Array (data.slice(0,data.byteLength)); break;}
        case ByteType.Float32Array:{ arr = new Float32Array(data.slice(0,data.byteLength)); break;}
        case ByteType.Float64Array:{ arr = new Float64Array(data.slice(0,data.byteLength)); break;}
    }
    return arr;
}

if(typeof module != 'undefined')
{
    if(module.exports)
    {
        module.exports.ByteType         = ByteType;
        module.exports.createTypedArray = createTypedArray;
        module.exports.bufferToArray    = bufferToArray;
    }
}