var angoose = require("angoose");
var async = require("async");
var Shell =require("./shell");
var Host = require("./host");
console.log("HOST: ", Host);
function joblogger(job, msg1, msg2, msg3){
    console.log("[JOB] "+job.name+": "+ msg1);
}
function scan(){
  var Job = angoose("Job");
  Job.findOne({status:"pending"}, function(err, job){
    if(job){
      joblogger(job,  "Found pending job");
      console.log(job)
      dispatch(job);
    }
      
  });
 }

 function updateStatus(job, newStatus, cb){
    var oldstatus = job.status;
    job.status = newStatus;
    job.last_update = new Date();
    job.save(function(err){
        if(!err)
            joblogger(job, "Changed status from "+oldstatus+" to "+ newStatus);
        else
            joblogger(job, "Failed to change status to "+ newStatus+": "+ err);
        cb(err);
    })
 }

 function dispatch(job){

    // verify job 
    // determine client
    if(!job.clients || job.clients.length ==0){
      joblogger(job, "Missing client machines");
      updateStatus(job, "draft");
      return;
    }
    var ids = [];
    job.clients && job.clients.forEach(function(item){
      ids.push(item._id)
    })
    angoose("Machine").find({_id: {$in: ids}}, function(err, clients){
        if(err || !clients){
          joblogger(job, "Unable to find client machine information: " + err);
          updateStatus(job, "draft");
          return;
        }
        console.log("Clients", clients)
        updateStatus(job, "running", function(err){ 
             joblogger(job, "Starting job");
             var cmd = prepareCommand(job, clients); //"cd YCSB; ./bin/ycsb run mongodb -s -P workload.template";
             var client = clients[0];
             var ctx = {
                host: client.hostname,
                port: client.port || 22,
                username: client.username,
                privateKey: client.key,
                path:""
             }
             joblogger(job, "Send command: "+ cmd);

             var host = Host(ctx);

             host.execute(cmd, function(err, res){
                if(err){
                  joblogger(job, "Error running command: "+ err);
                  return;
                }
                res.client = client.name;
                job.report = job.report || {};
                job.report.raw = job.report.raw || [];  // to delete
                job.report.raw =  [];
                job.markModified("report");
                //job.report.raw.push(res);

                // massage stats
                //  console.log("RAW", res.stdout)
                var stats  = parse(res.stdout+ res.stderr);
                job.report.stats = stats;
                
                job.results =  stats.OVERALL; 
                updateStatus(job, "completed", function(err){

                });

             })
        });

    });     
    
 }



 function prepareCommand(job, clients){
     var client = clients[0];
     var cmd = "cd ycsb; ./bin/ycsb run mongodb -s -P workload.template ";
     var spec = job.clientSpec || {};
     Object.keys(spec).forEach(function(key){
        if(typeof spec[key] == 'string' || typeof spec[key] == 'number'  )
          cmd+=" -p "+ key+"=\""+spec[key]+"\""
     })
     return cmd;
 }



function parse(text){
    var objs = [];
    var ret = {};
    var r = /(\{.*?metric.*?measurement.*?\})/g;
    text = text.replace(/\n/g, "");
    while((m=r.exec(text))){
      
      if(m[1]){
        
        var obj = JSON.parse(m[1]); 
        //console.log(obj);
        var metric = obj.metric;
        if(!obj.measurement ||  /^\d+$/.test(obj.measurement) || obj.metric == 'CLEANUP')
          continue;
        ret[metric] = ret[metric] || {};

        var key = mapKey(obj.measurement);
        if(!key) continue;
        var value = obj.value;
        
        value  = Math.round(value);

        ret[metric][key] = value;

      }
      
    }
    // average latency
    
    for(var j=0;j<3;j++){
        var latencies = ['latency_avg','latency_99th','latency_95th'];
        var latency_name = latencies[j];

        var total_latency = 0;
        var total_operations = 0;
        for(var k in ret){      
          var metric = ret[k];
          if(!metric.operations || ! metric[latency_name]) continue;
          total_latency += metric[latency_name] * metric.operations;
          total_operations+= metric.operations;
        }

        var lt = -1;
        if(total_latency && total_operations){
          lt = total_latency/total_operations;
          if(latency_name == 'latency_avg')  // this is in us
            lt= lt /1000
        }
            
        lt = Math.round(lt *10) / 10;
        ret.OVERALL = ret.OVERALL || {};
        ret.OVERALL[latency_name] = lt;
    }
     
    return ret;
} 

 var count = 0;
 async.whilst(
    function () { return count <50000; },
    function (callback) {
        if(count>0)
          scan();        
        if(count % 30 == 0) console.log("scanning...");
        count++;
        setTimeout(callback, 1000);
    },
    function (err) {
        // 5 seconds have passed
        console.log("job scanner completes!")

    }
);



function mapKey(key){
  var map = { 
        ">1000" : "",
        "Return=1" : "",
        "Return=0" : "",
        "99thPercentileLatency(ms)" : "latency_99th",
        "95thPercentileLatency(ms)" : "latency_95th",
        "MaxLatency(us)" : "latency_max",
        "MinLatency(us)" :  "latency_min",
        "AverageLatency(us)" : "latency_avg",
        "Operations" : "operations",
        "Throughput(ops/sec)" : "ops",
        "RunTime(ms)" :  "duration"
      }

  return map[key] || "" 
}