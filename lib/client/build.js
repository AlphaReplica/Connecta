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
var path     = require('path');
var https    = require('https');

var paths = [path.join(__dirname+"/../ByteArrayUtils.js"),
             path.join(__dirname+"/../ConnectaEnums.js"),
             path.join(__dirname+"/source/connectaPeer.js"),
             path.join(__dirname+"/source/connectaSocket.js"),
             path.join(__dirname+"/source/connecta.js")];
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

function checkDir(dir,cb)
{
    if(fs.existsSync(dir))
    {
        cb();
    }
    else
    {
        fs.mkdir(dir,cb);
    }
}
  
function build(name,codes)
{
    var result = UglifyJS.minify(codes, {});
    var dir    = path.join(__dirname,'build');

    checkDir(dir,()=>
    {
        fs.writeFile(path.join(dir,name), result.code, function(err)
        {
            if(err)
            {
                return console.log(err);
            }
            console.log(name+" was saved!");
        }); 
    });
}