var user_login = {
     userNameField:function(){
        return element(by.name('username'));
    },
    userPasswordField:function(){
        return element(by.id('password'));
    },
    userValueField:function(){
        return element(by.model('model[options.key]'))
    },
    getAlertText:function(){
        return element.all(by.css('.alert-danger'));
    },
    btnClick:function(){
        return element.all(by.css('.btn'));
    }
 }

 module.exports = user_login;
