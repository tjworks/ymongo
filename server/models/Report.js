

var angoose = require("angoose"); /** if angoose is installed as module, then require('angoose')*/
var mongoose = angoose.getMongoose();
var SubSchema = new mongoose.Schema({});
var CustomRef       = mongoose.Schema.Types.CustomRef;


// var clientSchema = SubSchema.extend({
//     hostname:     { type: String, required: true, label:'Name'},
//     score:        { type: Number, label: 'Score', default: 0}
// }, {keyfield:'answer.name', label:'Answer'});

var clientSpec =  {
            operationcount: { type:   Number,default: 1000,label:  'Operation Count'},
            recordcount: { type:   Number, default: 1000, label:  'Record Count'},
            threadcount: { type:   Number,                default: 32,label:  'Thread Count'},
            maxexecutiontime: { type:   Number,  default: 120, label:  'Max Run Time(s)'},
            readproportion: { type:   Number,  default: 120, label:  'Read Portion'},
            updateproportion: { type:   Number,  default: 120, label:  'Update Portion'},
            scanproportion: { type:   Number,  default: 120, label:  'Scan Portion'},
            insertproportion: { type:   Number,  default: 120, label:  'Insert Portion'},
            requestdistribution: {type: String, enum:['uniform', 'zipfian'],  label:'Request Distribution', default:'uniform' },
            insertorder: {type: String, enum:['hashed', 'ordered'],  label:'Insertion Order', default:'hashed' }
        } ;

// maxexecutiontime=120
// workload=com.yahoo.ycsb.workloads.CoreWorkload

// readallfields=true

// readproportion=0 
// updateproportion=0 
// scanproportion=0
// insertproportion=1

// requestdistribution=uniform

// insertorder=hashed

// fieldlength=50
// fieldcount=2

// mongodb.url=mongodb://localhost:27017
// mongodb.writeConcern=unacknowledged
// mongodb.batchsize=50
// target=50000
// threadcount=32


var serverSpec =  {
    mongourl: {
        type:   String,
        required:true,
        default: "localhost:27017",
        label:  'MongoDB Connection'
    },
    description: { type: String, label:"Server Configurations", template:"textarea"}
} ;

var report = {
     elapsed:  { type:   Number, label:  'Time Used' }
    ,avg_latency: {type: Number, label:  'Average Latency(ms)'}
    ,avg_ops: {type: Number, label:  'Average Throughput/s'}
}

var schema = mongoose.Schema({
       name: { type: String, tags:['default-list'], label:'Test Name'},
       //completed: {type:Boolean, tags:['default-list'], label:'Completed'},
       //leixing: {type:String, enum:['trial', 'procedure','drug'], tags:['default-list'], label:'Treatment' },
        // client: {
        //         type:           CustomRef,
        //         ref:            'Machine',
        //         fields:         { name: 'name' },
        //         label:  "Client",
        //         required: true
        //     },
       clients: {
            type: [{
                type:           CustomRef,
                ref:            'Machine',
                fields:         { name: 'name' }
            }],
            label: 'Client List',
            required: true
        },
        // servers: {
        //     type: [{
        //         type:           CustomRef,
        //         ref:            'Machine',
        //         fields:         { name: 'name' }
        //     }],
        //     label: 'Server List'  ,
        //     required: true
        // },
        clientSpec: clientSpec,
        serverSpec: serverSpec,
        preRun: {
            shellScript: {type:String, template:"textarea"},
            mongoScript: {type:String, template:"textarea"}  
        },
        postRun: {
            shellScript: {type:String, template:"textarea"},
            mongoScript: {type:String, template:"textarea"}  
        },
        report: report
       
});
module.exports = mongoose.model('Report', schema);
