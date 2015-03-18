var angoose = require("angoose"); /** if angoose is installed as module, then require('angoose')*/
var mongoose = angoose.getMongoose();

var	typeMap = mongoose.SchemaTypes.CustomRef.typeMap;


function populateByType(docs, path) {
	var pModels = {}, i, t;
	for (i = 0; i < docs.length; i++) {
		t = docs[i].get(path);
		if (!t || !t.type) continue;
		(pModels[typeMap[t.type]] || (pModels[typeMap[t.type]] = [])).push(docs[i]);
	}

	var out = new mongoose.Promise();

	out.resolve();

	var pop = function(targetModel) {	
		out = out.then(function() {
			return mongoose.model(targetModel).populate(pModels[targetModel], {
				path: path, 			// 'meta.office'
				model: targetModel 		// 'Office'
			});
		});
	};

	for (i in pModels) pop(i, pModels[i]);

	return out.then(function() { return docs; });

}


mongoose.Query.prototype.customPopulate = function(path, opts) {
	return this.exec().then(function(docs) { 
		return populateByType(docs, path, opts);
	});
};

mongoose.Document.prototype.customPopulate = function(path, opts) {
	return populateByType([this], path, opts).then(function(d) { return d[0] });
};













