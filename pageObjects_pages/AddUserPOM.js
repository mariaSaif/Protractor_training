var add_user = {
    clickAddButton:function(){
       return element(by.css('.icon-plus'));
    },
    userFirstName:function(){
       return element(by.name('FirstName'));
    },
    userLastName:function(){
       return element(by.name('LastName'));
    },
    userName:function(){
       return element(by.name('UserName'));
    },
    userPassword:function(){
       return element(by.name('Password'));
    },
    getCheckBoxValue:function(index){
        return element.all(by.name('optionsRadios')).get(index).click(); 
     },  
    getUserRole:function(role){
             //selecting dropdown value
      // return element(by.name('RoleId')).element(by.css("option[value='1']")).click();
      return element(by.name('RoleId')).element(by.cssContainingText('option',role)).click();
    },
    userEmail:function(){
      return element(by.name('Email'));
    },
    userPhone:function(){
      return element(by.name('Mobilephone'));
    },
    clickSave:function(){ 
      return element(by.css('.btn-success'));
    }
}

module.exports = add_user;
