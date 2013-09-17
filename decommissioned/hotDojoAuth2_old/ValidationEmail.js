define([
  'dojo/_base/declare',

  'dijit/form/ValidationTextBox',
  ], function(
    declare
  , ValidationTextBox
  ){

    var Validators = sharedFunctions.hotCoreCommonValidators;
    return declare('hotplate.hotDojoAuth.ValidationEmail', [ ValidationTextBox ], {

      validator: function(value){


        var validation =  Validators.email(value);

        if( ! validation ){
          this.invalidMessage = Validators.email(false);
          return false;
        }
        return true;

      },

      invalidMessage: Validators.email(false),
      missingMessage: Validators.notEmptyString(false),

    });

  }
);