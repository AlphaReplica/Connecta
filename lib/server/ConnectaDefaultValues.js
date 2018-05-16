/**
 * default values for connectaServer
 */
var defaultValues =
{
    key:'', // SSL key
    cert:'', // SSL certificate
    passphrase:'', // SSL password
    encryptMessage:false
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
    if(values.encryptMessage == undefined)
    {
        values.encryptMessage = defaultValues.encryptMessage;
    }
    return values;
}