define([
  'dojo/_base/declare',

  'dijit/form/ValidationTextBox',

  'app/widgets/_AjaxValidatorMixin',

  'app/lib/globals',
  'app/lib/stores',
  ], function(
    declare

  , ValidationTextBox
  , _AjaxValidatorMixin
  , g
  , stores
  ){
    return declare('app.ValidationUsername',  [ ValidationTextBox, _AjaxValidatorMixin ], {

      okIfPresent: true,
      ajaxInvalidMessage: 'Ajax check failed',

      validator: function(value){

        // Run the normal field validators -- if they fail,
        // return false
        var validation =  Validators.login(value);
        if( ! validation.result ){
          this.invalidMessage = validation.message;
          return false;
        }

        return this.ajaxValidate(value, {
           ajaxInvalidMessage: this.ajaxInvalidMessage,
           ajaxStore: stores.usersAnon,
           ajaxFilterField: 'login',
           ajaxOkIfPresent: this.okIfPresent,
        });

      },

      invalidMessage: "Username not valid",
      missingMessage: "Username cannot be empty",

    });
  }
);
