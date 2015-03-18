/**
    * query for task queue every second
    * pick up first job that is pending
    * determine the clients
    * use ssh to run ycsb
    * collect stats
*/

var Client = require('ssh2').Client;

// var conn = new Client();
// conn.on('ready', function() {
//   console.log('Client :: ready');
//   conn.exec('uptime', function(err, stream) {
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

// process.stdin.resume();

// process.on('SIGINT', function() {
//   console.log('Got SIGINT.  Press Control-D to exit.');
//   process.exit(0);
// });

