var login_objects = require('../pageObjects_pages/user_LoginPOM')
var helper = require('../utils/Helper')
var message = require('../utils/messages')
describe('Protractor Demo App', function() {
  beforeEach(function(){
    browser.get('http://www.way2automation.com/angularjs-protractor/registeration/#/login');
    var width = 1800;
    var height = 1500;
    browser.driver.manage().window().setSize(width, height);
  });

  it('should have a title', function() {
    expect(browser.getTitle()).toEqual(message.loginSiteTitle);
  });

  it('login with correct userName and password and verify home Page title and logout',function(){
    helper.login("angular","password","angular");
    browser.sleep(2000);
    var expectedValue = login_objects.homePageTitle().getText();
     expect(expectedValue).toContain(message.HomePagetitle); 
     helper.logout();
  });

  it('login with incorrect userName and password and verify invalid credentails Message',function(){
    helper.login("angularr","password","angularr");
    browser.sleep(5000);
    var expectedValue = login_objects.getAlertText().getText();
     expect(expectedValue).toContain(message.invalidCredentials); 
   
  });

      afterEach(function(){
        console.log("TestCases Executed Successfully");

      });
      });