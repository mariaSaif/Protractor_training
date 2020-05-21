var add_user = require('../pageObjects_pages/add_userPOM')
var helper = require('../utils/Helper')
var user = require('../utils/dataprovider')
var using = require('jasmine-data-provider');
describe('Protractor Demo App', function() {
    beforeEach(function(){
        browser.get("http://www.way2automation.com/angularjs-protractor/webtables/");
        var width = 1800;
        var height = 1500;
        browser.driver.manage().window().setSize(width, height);
    }
    )

 
    /* use of data provider*/
    using(user.userInfo, function (data,name) {
      it('should add a user and validate the correct user is being added'+" "+name ,async()=>{
        helper.addUser(data.first_name,data.last_name,data.user_name,data.user_password,data.index_value,data.user_role,data.user_email,data.user_phone);
       expect(data.first_name+" "+data.last_name).toMatch(helper.validateRow());
     }); 
    });  

     using(user.userInfo, function (data,name) {
      it('should update a user and validate the correct user is being updated'+" "+name,async()=>{
        helper.addUser(data.first_name,data.last_name,data.user_name,data.user_password,data.index_value,data.user_role,data.user_email,data.user_phone);
       expect(data.first_name+" "+data.last_name).toMatch(helper.validateRow());
       //Updating user
       helper.updateRecord("Mark");
       expect("Mark" + " " + data.last_name).toMatch(helper.validateRow());
     });  
  
 });
        afterEach(function(){
          console.log("TestCase Executed");
        });
        });