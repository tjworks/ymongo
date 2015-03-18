var Shell = require("./server/workers/shell");

function checkJava(){
  var cmd = "cd ~/work/ycsb; ./bin/ycsbs"
  Shell.execute(cmd, {
    host: 'localhost',
    port: 22,
    username: 'tjworks',
    privateKey: require('fs').readFileSync('/Users/tjworks/.ssh/id_rsa')
  }, function(err, code, stdout, stderr){  
    console.log("COMPLETED:   ",err, 'code:', code );
    //parse(stdout+stderr);
  })
}
executor = Shell.execute;

 var context = {
    host: 'localhost',
    port: 22,
    username: 'tjworks',
    privateKey: require('fs').readFileSync('/Users/tjworks/.ssh/id_rsa'),
    path: ""
  }

var client = require('scp2')
 
 


 var checkYCSB = function(callback){
       var cmd = "cd ~/ycsb; ./bin/ycsb";
       executor(cmd, context, function(err, ret){
          if(!ret || ret.code > 1 || (ret.code == 1 && !ret.stdout)){
            console.log("Failed to validate ycsb ", ret);
            console.log("Copying YCSB...");

            client.scp('public/ycsb.tar',  context , function(err) {
                console.log("Scp ycsb.tar completed", err || "success!");
                if(!err){
                    executor("tar -xvf ycsb.tar", context, function(err, ret2){
                          console.log("untar result", err || ret2.code || "success!", ret2);
                          if(!err && !ret2.code)
                            callback(true)
                          else
                            callback(false);                          
                    });
                }
            });            
          }          
          else 
            callback(true)
       })
    }

checkYCSB(function(res){
  console.log(res);
})
function parse(text){
  var r = /(\{.*?\})/g;
  text = text.replace(/\n/g, "");
  while((m=r.exec(text))){
    
    if(m[1]){
      var obj = JSON.parse(m[1]);
      if(obj.measurement && ! /^\d+$/.test(obj.measurement) && obj.metric != 'CLEANUP')
        console.log(obj);  
    }
    
  }
}
// var cmd = "cd work/ycsb; ./bin/ycsb run mongodb -s -P workloads/workloada"
// var conn = new Client();
// conn.on('ready', function() {
//   console.log('Client :: ready');
//   conn.exec(cmd, function(err, stream) {
//     if (err) throw err;
//     stream.on('close', function(code, signal) {
//       console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
//       conn.end();
//     }).on('data', function(data) {
//       console.log('STDOUT: ' + data);
//     }).stderr.on('data', function(data) {
//       console.log('STDERR: ' + data);
//     });
//   });
// }).connect({
//   host: 'localhost',
//   port: 22,
//   username: 'tjworks',
//   privateKey: require('fs').readFileSync('/Users/tjworks/.ssh/id_rsa')
// });

process.stdin.resume();

process.on('SIGINT', function() {
  console.log('Got SIGINT.  Press Control-D to exit.');
  process.exit(0);
});

