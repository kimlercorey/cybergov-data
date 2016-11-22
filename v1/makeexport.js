const exec = require('child_process').exec;

var itemsCount = 0;
var fs = require('fs');
var mkdirp = require('mkdirp');

var apiUrl = 'http://localhost/api';

var contentTypes = [
  'globals',
  'collections',
  'sections',
  'articles',
  'questions'
]
var numberOfContentTypes = contentTypes.length;
var exportsCount = numberOfContentTypes + 1;


for (var i = 0; i < numberOfContentTypes; i++) {
  deleteContentType(contentTypes[i]);
  exportContentType(contentTypes[i]);
}


function deleteContentType(itemType) {
  exec('rm *.json; rm -rf ' + itemType + ';', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    //console.log(`stderr: ${stderr}`);
    exportsCount = exportsCount -1;
    processRecords();
  });
}


function exportContentType(itemType) {

  exec('mongoexport --db test-keystone --collection ' + itemType + ' --out ' + itemType + '.json --jsonArray', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    //console.log(`stderr: ${stderr}`);
    exportsCount = exportsCount -1;
    processRecords();
  });

}


function processRecords(){
  if (exportsCount == 0) {
    console.log("Done exporting");
    for (var i = 0; i < numberOfContentTypes; i++) {
      startRead(contentTypes[i]);
    }
  }
}


function startRead(itemType){

   mkdirp( itemType, function(err) {
       if (err) console.log(err);
   });
   console.log("\n *STARTING* " + itemType + " \n");
   // Get content from file
   var contents = fs.readFileSync( itemType+".json");
   // Define to JSON type
   var jsonContent = JSON.parse(contents);
   // Get Value from JSON
   itemsCount = itemsCount + jsonContent.length;

   for (var i = 0; i < jsonContent.length; i++) {
  console.log("--------------------------------------------"+itemType+"["+i+"]");

    var item = jsonContent[i]
    var itemId = item._id.$oid
    var pre, post

    // TRANSFORMATIONS TO COMPLY WITH REGULAR API FORMAT
    // export feeds transforms id to id {oid:xxxxx}, this converts it back when in this format
    if (item._id.$oid != null) item._id = item._id.$oid;
    // individual items do not include the collection type but angular expects it
    if (itemType) {
      pre = '{"'+itemType.slice(0, -1)+'" :';
      post = '}';
    }

    item = pre + JSON.stringify(item)+ post

             //console.log(itemId);
             //console.dir(item);

       fs.writeFile(itemType+"/"+itemId+".json", item, function(err) {
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


  console.log("\n *EXIT "+ itemType +"* \n");

  function cleanUp(){
    if (itemsCount == 0) {
      console.log("Start CLEANUP");

      var command = '';
      for (var i = 0; i < numberOfContentTypes; i++) {
        command += 'curl -o ' + contentTypes[i] + '.json ' + apiUrl + '/v1/' + contentTypes[i] + '; ';
      }

      console.log(command);

      exec(command + 'curl -o nav.json ' + apiUrl + '/v2/collections;', (error, stdout, stderr) => {
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

// mongoexport --db test-keystone --collection collections --out collections.json --jsonArray
// mongoexport --db test-keystone --collection sections --out sections.json --jsonArray
// mongoexport --db test-keystone --collection articles --out articles.json --jsonArray

// upgrade to mongo 3 so that we can use the following:
// mongodump --db test-keystone --gzip --archive=test-keystone
// mongorestore --gzip --archive=test-keystone
