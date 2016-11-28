const exec = require('child_process').exec;

var itemsCount = 0;
var fs = require('fs');
var mkdirp = require('mkdirp');
var forEachSync = require('async-foreach').forEach;
var X2JS = require('x2js');
var request = require('request');
var dateformat = require('dateformat');
var hashGen = require('object-hash');


//var apiUrl = 'http://localhost/api';
var apiUrl = 'http://cyber.tcg.com/api';

var contentTypes = [
  'globals',
  'collections',
  'sections',
  'articles',
  'questions'
]
var exportsCount = contentTypes.length;


var deleteTypes = '';
forEachSync(contentTypes, function(contentType) {
  deleteTypes =+ contentTypes + ' ';
});
exec('rm -rf ' + deleteTypes + ';', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});


forEachSync(contentTypes, function(contentType) {
  exec('mongoexport --db test-keystone --collection ' + contentType + ' --out ' + contentType + '.json --jsonArray', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    //console.log(`stderr: ${stderr}`);
    exportsCount = exportsCount -1;
    processRecords();
  });
});


function processRecords(){
  if (exportsCount == 0) {
    console.log("Done exporting");
    forEachSync(contentTypes, function(contentType) {
      startRead(contentType);
    });
  }
}


function startRead(contentType){

  mkdirp( contentType, function(err) {
      if (err) console.log(err);
  });
  console.log("\n *STARTING* " + contentType + " \n");
  // Get content from file
  var contents = fs.readFileSync( contentType+".json");
  // Define to JSON type
  var jsonContent = JSON.parse(contents);
  // Get Value from JSON
  itemsCount = itemsCount + jsonContent.length;

  for (var i = 0; i < jsonContent.length; i++) {
    console.log("--------------------------------------------"+contentType+"["+i+"]");

    var item = jsonContent[i]
    var itemId = item._id.$oid
    var pre, post

    // TRANSFORMATIONS TO COMPLY WITH REGULAR API FORMAT
    // export feeds transforms id to id {oid:xxxxx}, this converts it back when in this format
    if (item._id.$oid != null) item._id = item._id.$oid;
    // individual items do not include the collection type but angular expects it
    if (contentType) {
      pre = '{"'+contentType.slice(0, -1)+'" :';
      post = '}';
    }

    item = pre + JSON.stringify(item)+ post

    //console.log(itemId);
    //console.dir(item);

    fs.writeFile(contentType+"/"+itemId+".json", item, function(err) {
      if(err) {
        return console.log(err);
      }
      //console.log( "wrote:", item);
      itemsCount = itemsCount -1;
      cleanUp();
      //console.log("The file was saved!");
    });

    console.log("--------------------------------------------");
  }


  console.log("\n *EXIT "+ contentType +"* \n");

  function cleanUp(){
    if (itemsCount == 0) {
      console.log("Start CLEANUP");

      var command = '';
      forEachSync(contentTypes, function(contentType) {
        command += 'sudo curl -o ' + contentType + '.json ' + apiUrl + '/v1/' + contentType + '; ';
      });

      command += 'sudo curl -o nav.json ' + apiUrl + '/v1/collections;';

      console.log(command);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        exec('mongodump --db test-keystone', (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`);
            return;
          }
          console.log("done.");
        });

      });

    }
  }
}


// Get alerts XML from external source and write JSON

var x2js = new X2JS();
var url = 'https://www.us-cert.gov/ncas/alerts.xml';
request(url, function(req, res) {
  var raw = x2js.xml2js(res.body);
  var jsonString = '{"alerts": [';

  raw.rss.channel.item.forEach(function(raw, index) {
    var o = new Object();
    var single = '{"alert": ';
    var hash = hashGen(raw.title.substring(0, raw.title.indexOf(":")));

    o._id = hash;
    o.certid = raw.title.substring(0, raw.title.indexOf(":"));
    o.title = raw.title.substring(raw.title.indexOf(":") + 2);
    o.link = raw.link;

    var pubDate = dateformat(raw.pubDate, "isoUtcDateTime");
    o.publishedDate = pubDate;

    var over = raw.description.match("<h3>Overview</h3>\n\t\t<p>(.*)</p>\t\t\n\t\t<h3>")[1];
    over = over.replace(/\[.*\]/g,'');
    over = over.replace(/(<([^>]+)>)/ig, '');
    over = over.split(' ').slice(0,24).join(' ');
    o.overview = over + '&hellip;';

    single = single.concat(JSON.stringify(o), '}');
    singleFile = 'alerts/' + hash + '.json';
    fs.writeFile(singleFile, single);

    if (index == 0) {
      jsonString = jsonString.concat(JSON.stringify(o));
    } else {
      jsonString = jsonString.concat(', ', JSON.stringify(o));
    }
  });

  jsonString = jsonString.concat(']}');
  fs.writeFile('alerts.json', jsonString);
});

// mongoexport --db test-keystone --collection collections --out collections.json --jsonArray
// mongoexport --db test-keystone --collection sections --out sections.json --jsonArray
// mongoexport --db test-keystone --collection articles --out articles.json --jsonArray

// upgrade to mongo 3 so that we can use the following:
// mongodump --db test-keystone --gzip --archive=test-keystone
// mongorestore --gzip --archive=test-keystone
