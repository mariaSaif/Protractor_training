var user_login_pom_element = require('../pageObjects_pages/userLoginPOM')
var add_user_pom_element = require('../pageObjects_pages/AddUserPOM')

var funcs = {

 x : {
    firstName:"John", 
    lastName:"Doe",
    username:"user name",
    password: "1234556",
    radio_index:0,
    role:"Sales Team",
    email:"test@gmail.com",
    phone:"123456788",
},   // Object

 login:function(username,password,uservalue){
    user_login_pom_element.userNameField().sendKeys(username);
    user_login_pom_element.userPasswordField().sendKeys(password);
    user_login_pom_element.userValueField().sendKeys(uservalue);
    user_login_pom_element.btnClick().click();
},
addUser:function(firstname,lastname,username,password,radio_btn_index,role,email,phone){
    add_user_pom_element.clickAddButton().click();
    add_user_pom_element.userFirstName().sendKeys(firstname);
    add_user_pom_element.userLastName().sendKeys(lastname);
    add_user_pom_element.userName().sendKeys(username);
    add_user_pom_element.userPassword().sendKeys(password);
    add_user_pom_element.getCheckBoxValue(radio_btn_index);
    add_user_pom_element.getUserRole(role);
    add_user_pom_element.userEmail().sendKeys(email);
    add_user_pom_element.userPhone().sendKeys(phone);
    add_user_pom_element.clickSave().click();
},
   validateRow:function(){
        /* will get value by tag name for specific cell*/
         element.all(by.tagName('td')).get(2).getText().then(function(val){
         element.all(by.tagName('td')).get(3).getText().then(function(a){
         return val;
         });
        });
        
        // var rowstransHistDetail = element(by.id('.smart-table')).all(by.tagName("tr"));
        /*by adding elemetn.all it will show values of full able where as adding element will show
        single row*/  

        // element.all(by.css('.smart-table-data-row')).getText().then(function(valueQty){  
        //   console.log(valueQty);

        /*by adding element.all with repeater and using get function will get specific rows
        */  
        //   element.all(by.repeater('dataRow in displayedCollection')).get(1).getText().then(function(valueQty){  
        //   return (valueQty);
        //   });
    
}
}
module.exports = funcs;