var dummy
  , path = require('path')
  , hotplate = require('hotplate')

  , ObjectId = require('mongowrapper').ObjectId
  , checkObjectId = require('mongowrapper').checkObjectId

  , hat = require('hat')

  , bcrypt = require('bcrypt')
  , SALT_WORK_FACTOR = 15
  , db = hotplate.get('db')
  , e = require('allhttperrors')

  , Schema = require('simpleschema')
  , MongoSchemaMixin = require('simpleschema/MongoSchemaMixin.js')

  , declare = require('simpledeclare')
;

Schema = declare( [ Schema, MongoSchemaMixin ] );

// db = hotplate.get('db')

/*
Comprehensive login framework for hotPlate.
A few facts:

## SESSION

To be "logged in" means that: 

 - req.session.loggedIn == true
 - req.session.login    == <username>
 - req.session.userId == <userId>

The variable `req.session.login` MAY hang around (is not zeroed on logout) as it MAY be used to pre-set the login field

## MIDDLEWARE VARIABLES

Using workspaceId (AJAX) tokenIdCall (AJAX) and workspaceIdPages (pages), the following
variables in req will be set:

 - req.application.workspace
 - req.application.user
 - req.application.access

*/

var app = hotplate.app;

var hooks = exports.hotHooks = {}

hooks.init = function( done ){

  // Middleware parameters that set req.application
  app.param( 'workspaceIdPages', paramWorkspaceIdPages);     // Used by /ws/WORKSPACEID
  app.param( 'tokenCall',        paramTokenCall);            // Used by API calls
  app.param( 'workspaceId',      paramWorkspaceIdCall);      // Used by API calls

  // Other middleware parameters
  //app.param( 'mongoId',             mongoIdCall);               // Used by API calls (generic ID)

  done( null );
}


hooks.run = function( done ){


  // Calls to check if users and workspaces are taken
  app.get(  '/call/usersAnon',      getUsersAnon );
  app.get(  '/call/workspacesAnon', getWorkspacesAnon );

  // Calls to actually create workspaces
  app.post( '/call/workspacesAnon', postWorkspacesAnon );
  app.post( '/call/workspacesUser', postWorkspacesUser );

  // Login, logout, recover calls
  app.post( '/call/recoverAnon',    postRecoverAnon );
  app.post( '/call/loginAnon',      postLoginAnon );
  app.get(  '/call/logoutUser',     getLogoutUser );

  done( null );

}

hooks.clientPaths = function( done ){
  done( null, { moduleName: 'hotMongoAuth', result: [ path.join(__dirname, '../client') ] } );
}


hooks.stores = function( done ){
  done( null, {
    usersAnon     : { target: '/call/usersAnon',      idProperty: '_id', sortParam: 'sortBy', },
    workspacesAnon: { target: '/call/workspacesAnon', idProperty: '_id', sortParam: 'sortBy', },

    workspacesUser: { target: '/call/workspacesUser', idProperty: '_id', sortParam: 'sortBy', },

    loginAnon     : { target: '/call/loginAnon',      idProperty: '_id', sortParam: 'sortBy', },
    recoverAnon   : { target: '/call/recoverAnon',    idProperty: '_id', sortParam: 'sortBy', },
    logoutUser    : { target: '/call/logoutUser',     idProperty: '_id', sortParam: 'sortBy', },
  });
}



/* **************************************************
 *
 * Parameters
 *
 * **************************************************
*/

/*
paramWorkspaceIdPages = function( req, res, next, workspaceId ){

  req.application = {};

  var workspaces = db.collection('workspaces');
  var users = db.collection('users');

  // User is not logged in (?!?): redirect to the login page
  if(! req.session.loggedIn ){
   res.redirect( '/pages/login' );
   return;
  }

  // FIXME http://stackoverflow.com/questions/12192463/error-handler-when-throwing-in-express
  // Check that the workspaceId is in a valid format
  if(  ! checkObjectId( workspaceId )){
    // res.status = 404;
    //hotplate.get('errorPage')(req, res, next);
    next( new e.NotFoundError() );
    return;
  }

  workspaces.findOne({ _id: ObjectId( workspaceId ), 'access._id': ObjectId( req.session.userId) }, 
                    function(err, doc){
    if(err){
       //res.status = 500;
       //hotplate.get('errorPage')(req, res, next);
       next( err );
    } else {
      if(doc){


        req.application.access = doc.access.map( function(item){ if( item._id == req.session.userId) return item; })[0];
        req.application.workspace = doc;

        users.findOne({ _id: ObjectId( req.session.userId ) }, function(err, doc){
          if( err ){
            next( err );
          } else {
            req.application.user = doc;
            next();
          }
        });

      } else {
        res.redirect('/pages/login') ;
      }
    }
  });
};


paramWorkspaceIdCall = function( req, res, next, workspaceId ){
  req.application = {};

  var workspaces = db.collection('workspaces');
  var users = db.collection('users');

  // Not authorized to do anything as not logged in
  if(! req.session.loggedIn){
    next( new e.UnauthorizedError() );
    return;
  }
  
  // Check that the workspaceId is in a valid format
  if( ! checkObjectId(workspaceId) ) {
      next( new e.UnprocessableEntityError( "Workspace id not valid" ) );
      return;
  }

  // Attempts to set the required variables
  workspaces.findOne({ _id: ObjectId(workspaceId), 'access._id': ObjectId( req.session.userId ) }, 
                     function(err, doc){
    if( err ){
      next( err );
    } else {

     

      if(doc){

        req.application.access = doc.access.map( function( item ){ if( item._id == req.session.userId ) return item; })[0];
        req.application.workspace = doc;

        // Attempts to set the required variables
        users.findOne({ _id: ObjectId( req.session.userId ) }, function(err, doc){
          if( err ){
            next( err );
          } else {
            req.application.user = doc;
            next();
          }
        });
      } else {
        next( new e.UnauthorizedError() );
      }
    }
  });
};




/*
var mongoIdCall = function( req, res, next, id ){

  // Check that the ID is in a valid format
  if( ! checkObjectId(id) ) {
      next( new e.UnprocessableEntityError( "ID not valid:" + id) );
      return;
  }
  next();
}
*/


// MERC: FIXME: paramTokenCall 100% untested
var paramTokenCall = function( req, res, next, token ){

  var accessEntry;
  var users = db.collection('users');
  var workspaces = db.collection('workspaces');

  req.application = {};

  // Find the token, fetch it (along with the workspace name)
  workspaces.findOne({ 'access.token': token } , function(err, doc){
    if(err){
      next( err );
    } else {
      if(! doc ){
        next( new e.BadTokenError() );
      } else {

        accessEntry = doc.access.filter( function( o ){ return o.token == token; } )[0];

        req.application.access = accessEntry;
        req.application.workspace = doc;

        users.findOne({ '_id': ObjectId( accessEntry._id ) } , function(err, doc){
          if(err){
            next( err );
          } else {
            if(! doc ){
              next( new e.BadTokenError() );
            } else {
              req.application.user = doc;
              // req.application.login = doc.login;
              next();
            }
          }
        });
      }
    }
  });
}


/* 
 **************************************************
 *
 * Actual callbacks
 *
 * **************************************************
*/


/*
  RESTful call: getUsersAnon
  Example     : GET /UsersAnon?login=something
  Params      : * login: Mandatory. Login name
  Notes       : It's an anonymous RESTful call to check if a login name is
                taken or not. Used in registration form. It will never
                work as a generic filter, and that's why the parameter is required
*/

var getUsersAnon = function(req, res, next){

  var login = req.query.login;
  var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;
  var users = db.collection('users');
     
  // Looks for a workspace. If it's there, answers without errors. If not,
  // answers with a very short error

  if( typeof(login) === 'undefined' ){
    next(new e.UnprocessableEntityError({ message: "'login' filter not passed", errors: [ { field: 'name', message : 'parameter required'} ] } ) );
  } else {
    users.findOne({ login: login.toLowerCase() }, function(err, doc){
      if(err ){
        next( err );
      } else {
        // Note: returns a simplified version of the record as
        // this is asked from an anonymous source
        if(doc){
          sendResponse( res, [ { login:login } ] );
        } else {
          sendResponse( res, [] );
       }
      }
    });
  }
}; 

function parametersAreThere(obj, attributes, errors){
  attributes.forEach(function(attribute){
    if( typeof(obj) === 'undefined' || typeof(obj[attribute]) == 'undefined'){
      errors.push( { field: attribute, message: 'Required attribute not provided: ' + attribute, mustChange: false } );
    }
  }); 
}

function parametersNotEmpty(obj, attributes, errors){
  attributes.forEach(function(attribute){
    if( obj[attribute] == '' ){
      errors.push( { field: attribute, message: 'Value cannot be empty: ' + attribute, mustChange: false } );
    }
  }); 
}


/*
  RESTful call: getWorkspaceAnon
  Example     : GET /WorkspaceAnon?name=something
  Params      : * name: Mandatory. Workspace name
  Notes       : It's an anonymous RESTful call to check if a workspace is
                taken or not. Used in registration form. It will never
                work as a generic filter, and that's why the parameter is required
*/
var getWorkspacesAnon = function(req, res, next){

  var name = req.query.name;
  var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;

  // Looks for a workspace. If it's there, answers without errors. If not,
  // answers with a very short error
  var workspaces = db.collection('workspaces');
  if( typeof( name ) === 'undefined' ){
    next(new e.UnprocessableEntityError({ message: "'name' filter not passed", errors: [ { field: 'name', message : 'parameter required'} ] } ) );
  } else {
    workspaces.findOne({ name: name.toLowerCase() }, function(err, doc){
      if(err ){
        next( err );
      } else {
        // Note: returns a simplified version of the record as
        // this is asked from an anonymous source
        if(doc){
          sendResponse( res, [ { name: name } ]  ); 
        } else {
          sendResponse( res, [] ); 
       }
      }
    });
  }
}



var saltPassword = function( password, callback ){

  bcrypt.genSalt( SALT_WORK_FACTOR, function(err, salt) {
    if (err) return callback(err);

    // hash the password using our new salt
    bcrypt.hash( password, salt, function( err, hash ) {
      if (err) return callback( err, null );

      // override the cleartext password with the hashed one
      callback( null, hash );
    });
  });
}

var comparePassword = function( candidatePassword, password, cb ) {
  bcrypt.compare(candidatePassword, password, function( err, isMatch ) {
    if( err ) return cb( err );
    cb( null, isMatch );
  });
};



var postWorkspacesAnon = function(req, res, next){

  var resUtils = hotplate.getModule('hotCoreResUtils');

  // *****
  setTimeout(function(){
  // *****

  var errors = [];
  var workspaces = db.collection('workspaces');
  var users = db.collection('users');
  var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;
  var Validators = hotplate.getModule('hotCoreSharedCode').sharedFunctions.hotCoreCommonValidators;


  // **************************************************************
  // PHASE #1: SOFT VALIDATION (NO DB INTERACTION YET)
  //           "Because you cannot trust client-side validation"
  // **************************************************************

  var passwordsMatch = function( object, errors ){

    var value = object['password'];
    if( value[ 0 ].toString() != value[1].toString() )
      errors.push( { field: 'password', message: "Passwords need to match!" } );
  }

  var options = { validator: passwordsMatch };

  var schema = new Schema({
    password     : { type: 'array',  required: true },
    login        : { type: 'string', notEmpty: true, required: true, fieldValidator:Validators.login, trim: 25 },
    workspace    : { type: 'string', notEmpty: true, required: true, lowercase: true, fieldValidator:Validators.workspace, trim: 30 },
    registerEmail: { type: 'string', notEmpty: true, required: true, lowercase: true, fieldValidator:Validators.email, trim: 70 },
  }, options );

  // Allow other modules to change the schema...
  hotplate.invokeAll('createWorkspaceAnonSchema', schema, function(){

    var body = Schema.clone( req.body );
    schema.castAndParams( body, errors );

    // There were errors: end of story, don't even bother the database
    if(errors.length){
      next( new e.UnprocessableEntityError({ errors: errors } ) );
    } else {
 
      // *******************************************************
      // PHASE #1: ADDING RECORDS TO DB (WITH CHECKS)
      // *******************************************************

      users.findOne( { login: req.body.login }, function(err, doc){
        resUtils.runtimeErrorIfErr( err, next, function(){

          // If the user exists, add it to the error array BUT keep going
          if(doc){
            errors.push({ field:'login', message: 'Login name taken, sorry!', mustChange: true } );
          }
          workspaces.findOne({ name: req.body.workspace }, function(err, doc){
            resUtils.runtimeErrorIfErr( err, next, function(){

              if(doc){
                errors.push( {field: "workspace", message: "Workspace taken, sorry!", mustChange: true} );
              } 

              // Check if there are any errors -- if so, return them and that's it
              if( errors.length ){
                next( new e.UnprocessableEntityError({ errors: errors } ) );
              } else { 

                //
                // AT THIS POINT, UNLESS SOMETHING JUMPS ON US, both user and workspace are available
                //

                // User doesn't exist: create it
                var u = new Object();
                u.login = req.body.login;
                u.password = req.body.password[0];
                u.registerEmail = req.body.registerEmail;
 
                // Password needs to be _very_ encrypted
                saltPassword( u.password, function( err, hash ){
                  resUtils.runtimeErrorIfErr( err, next, function(){

                    u.password = hash;
                    u._id = ObjectId();
                    hotplate.invokeAll('creatingUser', u, req.body, function(){
                      users.insert(u, function(err) {
                        resUtils.runtimeErrorIfErr( err, next, function(){
                          var w = new Object();
                          w.name = req.body.workspace;
                          w.activeFlag = true;
                          w.access = []; 


                          makeToken( function(err, token) {
                            resUtils.runtimeErrorIfErr( err, next, function(){

                              w.access.push( {  _id: u._id, token:token });
                              w._id = ObjectId();

                              hotplate.invokeAll('creatingWorkspace', u, w, req.body, function(){
                                workspaces.insert( w, function(err){
                                  resUtils.runtimeErrorIfErr( err, next, function(){

                                    // Login and password correct: user is logged in, regardless of what ws they were requesting access for.
                                    req.session.loggedIn = true;
                                    req.session.login = u.login;
                                    req.session.userId = u._id;

                                    sendResponse(res, { workspaceId: w._id } );

                                  }) // err
                                }) // w.insert()

                              }) // hotplace.involeAll('accessCreated')
 
                            }) // err
                          }) // makeToken()

                        }) // err
                      }) // u.insert

                    }) // invokeAll('userCreated')

                  }) // err
                }) // saltPassword()

              } // if(errors.length != 0)

            }) // err
          }) // workspaces.findOne()

        }) // err
      }); // users.findOne()

    }

  });
  //
  } , 500); // Artificial timeout
  //
}


var postWorkspacesUser = function(req, res, next){

  var resUtils = hotplate.getModule('hotCoreResUtils');
  var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;
  var Validators = hotplate.getModule('hotCoreSharedCode').sharedFunctions.hotCoreCommonValidators;

  var workspaces = db.collection('workspaces');
  var users = db.collection('users');
  var errors = [];

  // *****
  setTimeout(function(){
  // *****

  // Check user out if he's not logged in.
  // TODO: Move this into a middleware
  if(! req.session.loggedIn ){
    next( new e.UnauthorizedError('Not logged in'));
    return; 
  }

  // Make up the (simple) schema. A one-line schema might seem like a waste of time,
  // but it's good in case other modules want to change it through the
  // createWorkspaceUserSchema hook
  var schema = new Schema({
    workspace    : { type: 'string', notEmpty: true, required: true, lowercase: true, fieldValidator:Validators.workspace, trim: 30 },
  }, {} );


  // Allow other modules to change the schema...
  hotplate.invokeAll('createWorkspaceUserSchema', schema, function(){

    var body = Schema.clone( req.body );
    schema.castAndParams( body, errors );

    /* // FIXME: Take this out, allow aother modules to change the schema before continuing. Yes, one more indent.
    next( new e.UnprocessableEntityError('CHECK ERROR RESULTS', errors ) );
    return;
    */

    // There were errors: end of story, don't even bother the database
    if(errors.length){
      next( new e.UnprocessableEntityError({ errors: errors } ) );
    } else {
  
      // Step 1: Check that the workspace is not already taken
      workspaces.findOne({ name:req.body.workspace }, function(err, doc){
        resUtils.runtimeErrorIfErr( err, next, function(){

          if(doc){
            errors.push( {field: "workspace", message: "Workspace taken, sorry!", mustChange: true} );
            next( new e.UnprocessableEntityError({ errors: errors } ) );
          } else {

            // Assign values
            var w = new Object();
            w.name = req.body.workspace;
            w.activeFlag = true;

            makeToken( function(err, token) {
              resUtils.runtimeErrorIfErr( err, next, function(){

                w.access = [ {  _id: ObjectId( req.session.userId), token:token } ]; 

                users.findOne( { _id: ObjectId( req.session.userId) }, function(err, u){
                  resUtils.runtimeErrorIfErr( err, next, function(){

                    if( !u ){
                      next( new Error("Unable to lookup user from session") );
                    } else {
                   
 
                      hotplate.invokeAll( 'creatingWorkspace', u, w, function(){

                        workspaces.insert( w, function( err ){
                          resUtils.runtimeErrorIfErr( err, next, function(){

                            // Register the workspace, and return the worksapce Id in as an option (to allow redirect)
                            sendResponse( res, { workspaceId: w._id } ); 
                          })
                        }) // w.save

                      }) // invokeAll

                    } // if( !u)

                  })
                }) // users.findOne

              })
            }) // makeToken

          } // if( doc ) (else)

        })
      }) // workspaces.findOne

    } // if(errors.length) (else)

  }) // invokeAll
  //
  } , 500); // Artificial timeout
  //
}



var getLogoutUser = function(req, res, next){


  // *****
  setTimeout(function(){
  // *****

    var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;
    // There is nothing to be checked: simply logs out by clearing the session variables
    // NOTE: req.session.login is properly set to null as the user really wanted to logout
    // NOTE2: Maybe not. In which case would this not be set to null...?
    req.session.loggedIn = false;
    // req.session.login = null;

    // Send an OK response. It's up to the client to redirect/etc.
    sendResponse( res, {} );

  //
  } , 500); // Artificial timeout
  //

}


var postRecoverAnon = function(req, res, next){

  var resUtils = hotplate.getModule('hotCoreResUtils');
  var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;

  var errors = [];
  var workspaces = db.collection('workspaces');
  var users = db.collection('users');

  var schema = new Schema({
    registerEmail: { type: 'string', notEmpty: true, required: true, lowercase: true, fieldValidator:Validators.email, trim: 70 },
  }, {} );


  var body = Schema.clone( req.body );
  schema.castAndParams( body, errors );

  // There were errors: end of story, don't even bother the database
  if(errors.length){
     next( new e.UnprocessableEntityError({ errors: errors } ) );
    return;
  }

  // *******************************************************
  // PHASE #1: ADDING RECORDS TO DB (WITH CHECKS)
  // *******************************************************

  users.findOne( { registerEmail: req.body.registerEmail }, function(err, doc){
    resUtils.runtimeErrorIfErr( err, next, function(){

      // If the user exists, add it to the error vector BUT keep going
      if(doc){
        hotplate.log("Sending email for " + doc.registerEmail);
        // TODO: SEND EMAIL USING NEW EMAIL INFRASTRUCTURE
      }
      sendResponse( res );
    })

  }); // users.findOne()
}



var postLoginAnon = function(req, res, next){

  var resUtils = hotplate.getModule('hotCoreResUtils');
  var Validators = hotplate.getModule('hotCoreSharedCode').sharedFunctions.hotCoreCommonValidators;
  var sendResponse = hotplate.getModule('hotCoreProtocol').sendResponse;

  var errors = [];
  var users = db.collection('users');
  var workspaces = db.collection('workspaces');

  var schema = new Schema({
    login        : { type: 'string', notEmpty: true, lowercase: true, required: true, fieldValidator:Validators.login, trim: 25 },
    password     : { type: 'string', notEmpty: true, lowercase: true, required: true , trim: 40 },
    workspaceName: { type: 'string', notEmpty: true, lowercase: true, required: false , trim: 40 },
    remember     : { type: 'string', required: true },
  }, {} );

  var body = Schema.clone( req.body );
  schema.castAndParams( body, errors );

  // There were errors: end of story, don't even bother the database
  if( errors.length ){
     next( new e.UnprocessableEntityError({ errors: errors } ) );
    return;
  }
 
  var forWorkspaceId = '';
  
  users.findOne( { login: req.body.login }, function(err, docUser){
    // Log database error if it's there
    if(err ){
      next( err );
    } else {
      // Password is incorrect: return errors
      if(! docUser ) {
          next( new e.UnprocessableEntityError( { message: 'Password incorrect', errors: [ { field:'password', message: 'Password incorrect', mustChange: false } ] } ) );
      } else {
       
        comparePassword( req.body.password, docUser.password, function( err, isMatch){
          resUtils.runtimeErrorIfErr( err, next, function(){

            if( !isMatch){
              next( new e.UnprocessableEntityError( { message: 'Password incorrect', errors: [ { field:'password', message: 'Password incorrect', mustChange: false } ] } ) );
            } else {

              // Login and password correct: user is logged in, regardless of what workspace they were requesting access for.
              req.session.loggedIn = true;
              req.session.login = docUser.login;
              req.session.userId = docUser._id;

              // Set the life of the session cookie: just this browsing session,
              // or 2 weeks (depending on whether the user ticked "remember me" or not)
              if( req.body.remember[0] === 'on' ) {
                // req.session.cookie.maxAge = 14 * 24 * 3600 * 1000; // They ticked "remember me": set a deadline for the cookie
              } else {
                // req.session.cookie.expires = false; // No "remember me": remember till the browser closes
              }

              // The client requested a login for a specific workspace name: attempt to set forWorkspaceId (if they have
              // access to that specific workspace)
              if( typeof(req.body.workspaceName) !== 'undefined' ){

                users.findOne( { login: req.body.login } , function( err, docUser){
                  resUtils.runtimeErrorIfErr( err, next, function(){

                    workspaces.findOne( { 'name': req.body.workspaceName, 'access._id' : docUser._id }, function( err, docWorkspace ){
                      resUtils.runtimeErrorIfErr( err, next, function(){

                        if( docWorkspace ){
                          forWorkspaceId = docWorkspace._id;
                        }
                        sendResponse( res, { forWorkspaceId: forWorkspaceId } );

                      })
                    }); // workspaces.findOne

                  })
                }); //  users.findOne 

              } // if( req.body.workspaceName != '')


              // There was no specific requirement in terms of workspace, just return OK with empty forWorkspaceId
              else {

                // Finally send the OK response
                sendResponse( res, { forWorkspaceId: '' } );
  
              } // ELSE ( if( req.body.workspaceName != '') )

            } // else  ( if( !isMatch) )

          }) 
        }); // docUser.comparePassword( req.body.password, function( err, isMatch)
      }
    }
  }); // users.findOne()


}

var makeToken = function( callback ){

  var attempts = 0;
  look();

  function look(){
    workspaces = db.collection('workspaces');

    // Generate the token, check that it's indeed available
    var token = hat();
    workspaces.findOne( { 'access.token':token } , function(err, doc){

      // There is an error: call the callback returning an error
      if(err){
        callback(err, null);
      } else {

        // Token already there: either give up (too many attempts)...
        if( doc ){
          attempts ++;
          if( attempts == 5 ){
            callback( new Error("Cannot generate unique token"), null );
          } else {
            look();
          }
        // ... or try again by calling this function again!
        } else {
          callback(null, token );
        }
      }
    });
  }
}

