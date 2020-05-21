var user_login_pom_element = require('../pageObjects_pages/user_LoginPOM')
var add_user_pom_element = require('../pageObjects_pages/add_userPOM')

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

login:function(username,password,uservalue){
    user_login_pom_element.userNameField().sendKeys(username);
    user_login_pom_element.userPasswordField().sendKeys(password);
    user_login_pom_element.userValueField().sendKeys(uservalue);
    user_login_pom_element.btnClick().click();
    user_login_pom_element.homePageTitle
},
logout:function(username,password,uservalue){
    user_login_pom_element.Logoutbtn().click();
},
  
validateRow:async()=>{
    /* will get value by tag name for specific cell*/
    let first = await element.all(by.tagName('td')).get(2).getText();
    let second = await element.all(by.tagName('td')).get(3).getText();
    /*To get full row of a grid*/
    // var res = await element.all(by.tagName('tr')).get(2).getText();
    var name = first +" "+ second;
    // console.log(name)
    return name;

    },

    updateRecord:async(newName)=>{
        add_user_pom_element.editUser().click();
        add_user_pom_element.userFirstName().clear().sendKeys(newName);
        add_user_pom_element.clickSave().click();
    },
}
module.exports = funcs;