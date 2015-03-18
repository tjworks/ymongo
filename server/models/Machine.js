var angoose = require("angoose"); /** if angoose is installed as module, then require('angoose')*/
var mongoose = angoose.getMongoose();
var SubSchema = new mongoose.Schema({});
var schema = mongoose.Schema({
       name: { type: String, required: true, tags:['default-list'], label:'Descriptive name'},
       owner: { type: String,   tags:['default-list'], label:'Owner'},
       hostname: { type: String, required: true, tags:['default-list'], label:'Hostname'},
       username: { type: String, required: true, tags:['default-list'], label:'Login User'},
       key: {type:String, required:true, label:"Private Key Content", template:"textarea"},
       port: {type: Number, default:22, label:"SSH Port"}
});
module.exports = mongoose.model('Machine', schema);

var CustomRef = mongoose.Schema.Types.CustomRef;
CustomRef.typeMap['machine'] = 'Machine';