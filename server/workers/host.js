/**
    * query for task queue every second
    * pick up first job that is pending
    * determine the clients
    * use ssh to run ycsb
    * collect stats
*/

var Client = require('ssh2').Client;
var scpClient = require('scp2');


// context:
// {
//   host: 'localhost',
//   port: 22,
//   username: 'tjworks',
//   privateKey: require('fs').readFileSync('/Users/tjworks/.ssh/id_rsa')
// });
var executor = function(command, context, callback){
  var conn = new Client();

  var stderr = "";
  var stdout = "";
  conn.on('ready', function() {
    console.log('Client :: ready. ');    
    conn.exec( command, function(err, stream) {
        if (err) callback(err);
        stream.on('close', function(code, signal) {
          console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
          conn.end();
          var ret = {
            code:code,
            signal: signal,
            stdout: stdout,
            stderr: stderr
          }
          callback(null,ret);
        }).on('data', function(data) {
          //console.log('STDOUT: ' + data);
          stdout+=data;
        }).stderr.on('data', function(data) {
          //console.log('STDERR: ' + data);
          stderr+=data;
        });
      });
  })
  conn.connect(context);
}



module.exports = function(context){
    this.ctx = context;
    var self = this;
    this.isReady = function(callback){
      console.log("Checking Java...");
      self.checkJava(function(error){
          if(error)  return callback(error);
          console.log("Java is Okay.");
          self.checkYCSB(function(error){
              if(error) return callback("YCSB could not be installed, check logs");
              console.log("YCSB is Okay");
              callback(null, true);        
          });
      });       
    }
    this.execute = function(cmd, callback){      
      executor(cmd, context, callback);
    }; // end method

    this.checkJava = function(callback){
       var cmd = "java -version";
       executor(cmd, context, function(err, ret){
          if(!ret || ret.code ){
            console.log("Failed to validate java ", ret)
            callback("Failed to validate java ");
          }
          else
              callback(null)
       })
    }
    this.checkYCSB = function(callback){
       var cmd = "cd ~/ycsb; ./bin/ycsb";
       executor(cmd, context, function(err, ret){
          if(!ret || ret.code > 1 || (ret.code == 1 && !ret.stdout)){
            console.log("Failed to validate ycsb ", ret);
            console.log("Copying YCSB...");
            scpClient.scp('public/ycsb.tar',  context , function(err) {
                console.log("SCP ycsb.tar to remote host completed: ", err || "success!");
                if(!err){
                    executor("tar -xvf ycsb.tar", context, function(err, ret2){
                          console.log("untar result", err || ret2.code || "success!", ret2);
                          if(!err && !ret2.code)
                            callback(null)
                          else
                            callback("tar extraction failed: "+ ret2);                          
                    });
                }
            });            
          }          
          else 
            callback(null)
       })
    }
    return this;
}; 
