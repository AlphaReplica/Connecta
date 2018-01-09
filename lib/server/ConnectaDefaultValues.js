/**
 * default values for connectaServer
 */
var defaultValues =
{
    key:'', // SSL key
    cert:'', // SSL certificate
    passphrase:'', // SSL password
    divideConnections:true, // divides connections into processes
    spawnProcesses:true, // spawns processes on server creation
    masterIp:'127.0.0.1', // master process ip
    masterPort:9870, // master process port
    host:'127.0.0.1' // host for clients
}

module.exports.defaultValues  = defaultValues;

/**
 * adds properties with default values in object if properties doesn't exist
 * @method validateValues
 * @param {Object} values - value object
*/
module.exports.validateValues = function(values)
{
    if(!values)
    {
        values = {};
    }
    
    if(values.key == undefined)
    {
        values.key = defaultValues.key;
    }
    if(values.cert == undefined)
    {
        values.cert = defaultValues.cert;
    }
    if(values.passphrase == undefined)
    {
        values.passphrase = defaultValues.passphrase;
    }
    if(values.divideConnections == undefined)
    {
        values.divideConnections = defaultValues.divideConnections;
    }
    if(values.masterIp == undefined)
    {
        values.masterIp = defaultValues.masterIp;
    }
    if(values.masterPort == undefined)
    {
        values.masterPort = defaultValues.masterPort;
    }
    if(values.spawnProcesses == undefined)
    {
        values.spawnProcesses = defaultValues.spawnProcesses;
    }
    if(values.host == undefined)
    {
        values.host = defaultValues.host;
    }
    return values;
}