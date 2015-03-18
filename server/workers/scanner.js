var angoose = require("angoose");
var async = require("async");
var Shell =require("./shell");

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
                privateKey: client.key
             }
             joblogger(job, "Send command: "+ cmd);
             Shell.execute(cmd, ctx, function(err, res){
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

                var stats  = parse(res.stdout+ res.stderr);
                job.report.stats = stats;
                job.stats.ops = stats.ops;
                job.stats.latency = stats.latency;
                joblogger(job, "Stats: "+ stats);
                console.log(stats);
                updateStatus(job, "completed", function(err){

                });
             })
        });

    });     
    
 }


 function prepareCommand(job, clients){
     var client = clients[0];
     var cmd = "cd YCSB; ./bin/ycsb run mongodb -s -P workload.template ";
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
        console.log(obj);
        var metric = obj.metric;
        if(!obj.measurement ||  /^\d+$/.test(obj.measurement) || obj.metric == 'CLEANUP')
          continue;
        ret[metric] = ret[metric] || {};
        ret[metric][obj.measurement] = obj.value;

        if(obj.measurement == "Throughput(ops/sec)" && obj.metric == "OVERALL")
            ret.ops = Math.round(obj.value);
        
      }
      
    }
    // average latency
    var total_latency = 0;
    var total_operations = 0;
    for(var k in ret){
      var metric = ret[k];
      if(!metric.Operations || ! metric["AverageLatency(us)"]) continue;
      total_latency += metric["AverageLatency(us)"] * metric.Operations;
      total_operations+= metric.Operations;
    }
    if(total_latency && total_operations)
        ret.latency = total_latency/total_operations /1000
    ret.latency = Math.round(ret.latency*10) / 10;
    return ret;
} 

 var count = 0;
 async.whilst(
    function () { return count <500; },
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