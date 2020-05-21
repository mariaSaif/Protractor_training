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
       return element(by.xpath("//button[@class='btn btn-danger']"));
   },
   homePageTitle:function(){
    return element(by.xpath("//div[@class='ng-scope']/h1"));
},
Logoutbtn:function(){
    return element(by.xpath("//div[@class='ng-scope']/p/following-sibling::p/a[contains(text(),'Logout')]"));
}
}

module.exports = user_login;