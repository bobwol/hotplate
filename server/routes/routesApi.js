
var utils = require('../utils.js'),
fs = require('fs'),
g = require('../globals.js'),
mongoose = require('mongoose'),
e = require('../errors.js');

eval(fs.readFileSync('../client/validators.js').toString()); // Creates "Validators


// Returns the list of roles
exports.queryRolesApi1 = function(req, res, next){
  utils.sendResponse( res, { data: g.roles } );
}


exports.postUsersApi1 = function(req, res, next){

  var Workspace = mongoose.model('Workspace');
  next( new e.ValidationError422('Message', [{ field: 'name', message: 'ppp' }]) );
  
  // utils.sendResponse( res, { data: { name: 'ppp' } } );
}