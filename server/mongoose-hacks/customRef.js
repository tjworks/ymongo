var angoose = require("angoose"); /** if angoose is installed as module, then require('angoose')*/
var mongoose = angoose.getMongoose();

var traverse = require('traverse'),
	logger = require('log4js').getLogger('customRef'),
	ObjectId = mongoose.mongo.ObjectID,
	SchemaType = mongoose.Schema.Types.Mixed,
	Schema = mongoose.Schema;


var Ref = function() {};

Ref.prototype.toString = function() {
	return (this._id || 'Invalid CustomRef').toString();
};

var objectIdPattern = /^[0-9a-f]{24}$/;
var castObjectIds = function(obj) {
	traverse(obj).forEach(function(val) {
		if (typeof(val) === 'string' && objectIdPattern.test(val)) { // && this.key && this.key.indexOf('_id') >= 0 */
			this.update(mongoose.Types.ObjectId(val));
		}
	});
};

module.exports = function(typeMap) {

	function CustomRef() {
		SchemaType.apply(this, arguments);
		this.instance = 'CustomRef';
	}

	CustomRef.prototype = Object.create(SchemaType.prototype);

	CustomRef.prototype.constructor = CustomRef;

	CustomRef.prototype.setHooks = function(baseSchema, isArray) {
		var refOpts = this.options;
		if (!refOpts.fields) return; // no hooks if there are no fields to denormalize.

		var toColl = baseSchema.options.collection || baseSchema.options.parentSchemaCollection,
			path = this.path,
			refPath = (baseSchema.options.offset) ? baseSchema.options.offset + '.' + path : path,
			matchPath = (refPath != path) ? baseSchema.options.offset + '.$.' + path : refPath;

		logger.debug('adding pre-save hook for ref field', toColl + '.' + refPath, 'to load from ', refOpts.ref);

		baseSchema.pre('save', true, function(next, done) {
			next();
			if (!this.isModified(path)) return done(); // ref wasn't modified, nothing  to change.
			logger.debug('Modified paths:', this.modifiedPaths());
			var refData = this.get(path),
				dzFields = {},
				i;

				// console.log('REFDATA IS', JSON.stringify(refData, null, '\t'));


			for (i in refOpts.fields) dzFields[refOpts.fields[i]] = 1;

			if (Array.isArray(refData)) {
				// [CustomRef, CustomRef, ... ]

				if (!refData.length) return done();
				logger.debug('CustomRef at', refPath, 'was changed.  denormalizing data from type', refData[0] && refData[0].type);

				var oids = [];
				for (i = 0; i < refData.length; i++) {
					if (!refData[i] || !refData[i]._id || !refData[i].type) continue;
					oids.push(refData[i]._id);
				}

				if (!oids.length) return done();

				mongoose.model(refOpts.ref).find({
					_id: {
						$in: oids
					}
				}, dzFields, function(err, docs) {
					if (err) return done(new Error('Error retrieving data'));
					var hash = {}, i, ref, doc;
					for (i = 0; i < docs.length; i++) hash[docs[i]._id] = docs[i];
					for (i = 0; i < refData.length; i++) {
						ref = refData[i];
						if (!ref || !ref._id || !ref.type) continue;
						doc = hash[ref._id];
						if (!doc) return done(new Error('Invalid reference in "' + refPath + '". ' + refOpts.ref + ' #' + ref._id + ' does not exist.'));
						for (var f in refOpts.fields) ref[f] = doc.get(refOpts.fields[f]);
					}

					done();

				});

			} else {
				logger.debug('CustomRef at', refPath, 'was changed.  denormalizing data from type', refData && refData.type);

				var ref = refData;

				if (!ref || !ref._id || !ref.type) return done();

				var baseDoc = this.__parent || this;
				logger.debug('Denormalizing fields from', ref.type + '#' + ref._id, 'into', baseDoc.type + '#' + baseDoc._id + '.' + refPath);

				mongoose.model(CustomRef.typeMap[refData.type]).findById(refData._id, dzFields, function(err, doc) {
					if (err) return done(new Error('error retrieving data'));
					if (!doc) return done(new Error('Invalid reference: Referenced document ' + ref.type + '#' + ref._id + ' does not exist'));
					for (var i in refOpts.fields) ref[i] = doc.get(refOpts.fields[i]);
					logger.debug('Denormalization from', ref.type + '#' + ref._id, 'into', baseDoc.type + '#' + baseDoc._id + '.' + refPath, 'Completed Successfuly');
					done();
				});
			}
		});

		logger.debug('deferring add of pre-save hooks (', refOpts.ref, ') to denormalize into ' + toColl + '.' + refPath);

		process.nextTick(function() {
			var tBaseSchema = mongoose.model(refOpts.ref).schema, 
				targetSchemas = [{schema: tBaseSchema, name: 'Base'}],
				eSchema, ext;

			for(var i in mongoose.models) {
				eSchema = mongoose.models[i].schema;
				if (eSchema === baseSchema) continue;
				ext = eSchema.$$extends || [];
				for (var x = 0; x < ext.length; x++) {
					if (ext[x] === tBaseSchema) {
						targetSchemas.push({
							schema: eSchema,
							name: i
						});
						break;
					}
				}
			}



			targetSchemas.forEach(function(target) {
				logger.debug('adding pre-save hook for', refOpts.ref + '->' + target.name, 'to denormalize into ' + toColl + '.' + refPath);

				// [*TODO] loop through denormalized fields, and if it's a deep ref (patient-treatment.patient.office) 
				// we need to add the hook to the original source's schema, not the intermediate schema.

				target.schema.pre('save', true, function(next, done) {
					logger.debug('hook triggering for', refOpts.ref, 'to denormalize into', toColl + '.' + refPath);
					next();
					if (this.isNew) return done(); // nothing references this yet.
					
					var search = {},
						update = { $set: {} },
						flag = false,
						db = mongoose.connection.db;

					search[refPath + '._id'] = this.get('_id');

					for (var i in refOpts.fields) {
						if (this.isModified(refOpts.fields[i]) && (flag = true)) {
							logger.debug('field', refOpts.fields[i], 'in', this.constructor.modelName, 'MODIFIED');
							update.$set[isArray ? (matchPath + '.$.' + i) : (matchPath + '.' + i)] = this.get(refOpts.fields[i]);
						} else {
							logger.debug('field', refOpts.fields[i], 'in', this.constructor.modelName, 'NOT MODIFIED');
						}
					}
					if (!flag) return done();
					logger.debug('Denormalizing fields from', this.constructor.modelName, 'into', toColl + '.' + refPath);

					logger.debug('Search', search, 'Update', update);

					db.collection(toColl).update(search, update, { multi: true }, function(err, num) {
						if (err) {
							logger.debug('ERROR:', err);
							return done( new Error('Denormalization failed.'));
						}
						logger.debug('denormalized fields from', refOpts.ref, 'into', toColl+'.'+refPath, 'successfully.', num + ' documents updated.');
						done();
					});
				});
			});
		});
	};

	CustomRef.prototype.cast = function(value) {
		// logger.debug('CustomRef Cast called with', value, init);
		// if (!value || !value._id || !/^[a-f0-9]{24}$/.test(value._id)) {
			// return null;
		// }

		value = value || {};

		castObjectIds(value);

		var f = this.options.fields,
			out = new Ref();

		out._id = value._id && /^[a-f0-9]{24}$/.test(value._id) && ((value._id instanceof ObjectId) ? value._id : ObjectId(value._id));

		out.type = value.type;

		var i, isDoc = value instanceof mongoose.Document;
		for (i in f) out[i] = (isDoc) ? value.get(f[i]) : value[i];

		return out;

	};

	CustomRef.prototype.checkRequired = function(value) {
		return !!(value && (value._id instanceof ObjectId));
	};

	CustomRef.prototype.castForQuery = function($conditional, val) {
		return val;
	};

	CustomRef.typeMap = typeMap;


	mongoose.Schema.Types.CustomRef = CustomRef;

	var original_path = mongoose.Schema.prototype.path;

	mongoose.Schema.prototype.path = function(path, obj) {
		var out = original_path.apply(this, arguments);
		if (typeof obj == 'undefined') return out;

		var field = out.paths[path];
		if (field instanceof CustomRef) {
			field.setHooks(this);
		} else if (Array.isArray(field.options.type) && field.caster instanceof CustomRef) {
			field.caster.setHooks(this, true);
		}

		return out;
	};

	CustomRef.castObjectIds = castObjectIds;

};


/** hack the Query.exec to handle the _id field masked by customRef */

var origExec = mongoose.Query.prototype.exec;
//mongoose.Query.prototype



mongoose.Query.prototype.exec = function() {
	castObjectIds(this._conditions);
	origExec.apply(this, arguments);
};

var origExtend;
if ((origExtend = Schema.prototype.extend)) {
	Schema.prototype.extend = function(obj, options) {
		var ext = this.$$extends || [];
		delete this.$$extends;
		var newSchema = origExtend.call(this, obj, options);
		this.$$extends = ext;
		newSchema.$$extends = [this].concat(ext);
		return newSchema;
	};
}
