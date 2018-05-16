/**
 * Builds minified client library
 * 
 * Created by Mujirishvili Beka
 * 
 * 2 versions are builded:
 * - with shim webrtc adapter build/connecta-full.js
 * - without shim connecta-no-adapter.js
 */
var UglifyJS = require("uglify-js");
var fs       = require('fs');
var https    = require('https');

var paths = ["../ByteArrayUtils.js","../ConnectaEnums.js","source/connectaPeer.js","source/connectaSocket.js","source/connecta.js"];
const url = "https://webrtc.github.io/adapter/adapter-latest.js";

var codes = [];
for(var num = 0; num < paths.length; num++)
{
    codes.push(fs.readFileSync(paths[num], "utf8"));
}

build("connecta-no-adapter.js",codes);

https.get(url, res => 
{
    res.setEncoding("utf8");
    var body = "";
    res.on("data", data =>
    {
        body += data;
    });
    res.on("end", () =>
    {
        codes.unshift(body);
        build("connecta-full.js",codes);
    });
});

function build(name,codes)
{
    var result = UglifyJS.minify(codes, {});

    fs.writeFile('build/'+name, result.code, function(err)
    {
        if(err)
        {
            return console.log(err);
        }
        console.log(name+" was saved!");
    }); 
}