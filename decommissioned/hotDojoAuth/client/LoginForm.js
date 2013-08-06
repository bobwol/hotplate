
define([
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/json",
  "dojo/_base/fx",
  "dojo/on",

  "dijit/form/Form",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dijit/layout/TabContainer",
  "dijit/layout/StackContainer",
  "dijit/layout/ContentPane",
  "dijit/layout/BorderContainer",
  "dijit/form/Button",
  "dijit/form/ValidationTextBox",
  "dijit/form/CheckBox",

  "hotplate/hotDojoSubmit/defaultSubmit",
  "hotplate/hotDojoStores/stores",
  "hotplate/hotDojoLogger/logger",
  "hotplate/hotDojoWidgetHooks/_TemplatedHooksMixin",
  "dojo/text!hotplate/hotDojoAuth/templates/LoginForm.html",

  "hotplate/hotDojoAuth/ValidationUsername",
  "hotplate/hotDojoAuth/ValidationPassword",
  "hotplate/hotDojoAuth/ValidationEmail",

  "hotplate/hotDojoWidgets/AlertBar",
  "hotplate/hotDojoWidgets/StackFading",
  "hotplate/hotDojoWidgets/TabFading",
  "hotplate/hotDojoWidgets/BusyButton",

  "hotplate/bd/globals",

   ], function(
     declare
     , lang
     , json
     , baseFx
     , on

     , Form
     , _WidgetBase
     , _TemplatedMixin
     , _WidgetsInTemplateMixin
     , TabContainer
     , StackContainer
     , ContentPane
     , BorderContainer
     , Button
     , ValidationTextBox
     , CheckBox

     , ds
     , stores
     , logger
     , _TemplatedHooksMixin
     , templateString

     , ValidationUsername
     , ValidationPassword
     , ValidationEmail
     , AlertBar

     , StackFading
     , TabFading
     , BusyButton

     , globals
 ){
    // Create the "login" pane, based on a normal ContentPane
    return declare('hotplate.hotDojoAuth.LoginForm', [_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, _TemplatedHooksMixin ], {

      widgetsInTemplate: true,

      templateString:  templateString,

      // Hooks to switch tabs when clicking
      _onLoginClick: function(e){
        this.tabContainer.selectChild(this.loginPane);
      },

      _onRecoverClick: function(e){
        this.tabContainer.selectChild(this.recoverPane);
      },

      postCreate: function(){
        var that = this;

        //  If the global variable hotDojoAuth.login is set, then set the login name to
        //  the right value, and focus on the password widget
        if( vars.hotDojoAuth.login ){
          this.login.set( 'value', vars.hotDojoAuth.login );
          this.password.focus();
        } else {
          this.login.focus();
        }

        // If the password is in an erroneous state, reset it when user
        // clicks on the field. NOT before, as it would invalidate
        // the error message!
        this.password.on('click', function() {
          if( this.state === 'Error' ){
            this.set('value', '');
          }
        }),

        //this.password.onClick = function(){
        //};


        // Don't ACTUALLY submit the form
        this.recoverForm.onSubmit = ds.defaultSubmit(this.recoverForm, this.recoverButton, function(){

          // Get the form values
          var data = that.recoverForm.getValues();

          // Submit the info
          stores('recoverAnon', { workspaceId: globals.workspaceId } ).put(data).then(
            ds.UIMsg( that.recoverButton, that.recoverAlertBar, "Recovery email sent!" ),
            ds.UIErrorMsg( that.recoverForm, that.recoverButton, that.recoverAlertBar, true)
          ).then(
            function(res){

              // Show the alertbar's message that everything is OK
              // that.recoverAlertBar.set('message', "Recovery email sent!");
              // that.recoverAlertBar.show(3000);

              // Reset the form and button
              that.recoverForm.reset();
              that.recoverButton.cancel();
            }

          ); // stores('recoverAnon').put(data)


        }); // this.recoverForm.onSUbmit



        // Submit function
        this.loginForm.onSubmit = ds.defaultSubmit(this.loginForm, this.loginButton, function(){

          // Get the form's values, adding workspaceNameValue (which comes from the page)
          var data = that.loginForm.getValues();

          // Gets the workspaceName from the URL. If it's empty, actually delete
          // the variable as if present it's not allowed to be empty
          data.workspaceName = window.location.pathname.split(/\//)[3];
          if( data.workspaceName == '' ){
             delete data.workspaceName;
          }

          // Store the data 
          stores('loginAnon', { workspaceId: globals.workspaceId } ).put(data).then(
            ds.UIMsg( that.loginButton, that.loginAlertBar, 'Logging in...' ),
            ds.UIErrorMsg( that.loginForm, that.loginButton, that.loginAlertBar )
          ).then(
            function(res){
              if( typeof(that.onLogin) === 'function'){
                 console.log(res);
                 that.onLogin(res, that.loginForm.getValues() );
              }
            },
            function(err){
              // Password incorrect, set it to nothing, give it the focus!
              // that.password.set('value','');
              // that.password.focus();
            }
          );  // stores('loginanon').put(data)
 
        }); // this.loginform.onSubmit

     }, // postcreate

  });

});


