/**
 * default values for connectaServer
 */
var defaultValues =
{
    key:'', // SSL key
    cert:'', // SSL certificate
    passphrase:'', // SSL password
    encryptMessage:false, // if enabled string messages will be enctypted to base64
    rootKey:"root", // rootkey for POST request
    pingInSeconds:10 // ping every client in seconds
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
    if(values.rootKey == undefined)
    {
        values.rootKey = defaultValues.rootKey;
    }
    if(values.cert == undefined)
    {
        values.cert = defaultValues.cert;
    }
    if(values.passphrase == undefined)
    {
        values.passphrase = defaultValues.passphrase;
    }
    if(values.encryptMessage == undefined)
    {
        values.encryptMessage = defaultValues.encryptMessage;
    }
    if(values.pingInSeconds == undefined)
    {
        values.pingInSeconds = defaultValues.pingInSeconds;
    }
    return values;
}