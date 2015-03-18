/**
    * query for task queue every second
    * pick up first job that is pending
    * determine the clients
    * use ssh to run ycsb
    * collect stats
*/

var Client = require('ssh2').Client;


// context:
// {
//   host: 'localhost',
//   port: 22,
//   username: 'tjworks',
//   privateKey: require('fs').readFileSync('/Users/tjworks/.ssh/id_rsa')
// });


exports.execute = function(command, context, callback){
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
