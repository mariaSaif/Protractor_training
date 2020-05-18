
describe('Protractor Demo App', function() {
  beforeEach(function(){
    browser.get('http://www.way2automation.com/angularjs-protractor/registeration/#/login');
    var width = 1800;
    var height = 1500;
    browser.driver.manage().window().setSize(width, height);
  });

    it('Login /Logout over angular application', function() {
        
        element(by.model('Auth.user.name')).sendKeys("angular");
        element(by.model('Auth.user.password')).sendKeys("password");
        element(by.id('formly_1_input_username_0')).sendKeys("angular");
        element(by.xpath("//button[@class='btn btn-danger']")).click();
        var foo = element(by.xpath("//div[@class='ng-scope']/h1"));
        expect(foo.getText()).toEqual('Home');
        //click on logout
        element(by.xpath("//div[@class='ng-scope']/p/following-sibling::p/a[contains(text(),'Logout')]")).click();

      });

      it('Verify error message on incorrect credentials', function() {
        element(by.model('Auth.user.name')).sendKeys("angularr");
        element(by.model('Auth.user.password')).sendKeys("password");
        element(by.id('formly_1_input_username_0')).sendKeys("angularr");
        element(by.xpath("//button[@class='btn btn-danger']")).click();
        //verify message on incorrect UserName
        var foo = element(by.xpath("//div[@class='alert alert-danger ng-binding ng-scope']"));
        expect(foo.getText()).toEqual('Username or password is incorrect');
      });

      afterEach(function(){
        console.log("TestCases Executed Successfully");

      });
      });