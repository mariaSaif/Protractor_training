describe('Protractor Demo App', function() {
    beforeEach(function(){
        browser.get("http://www.way2automation.com/angularjs-protractor/webtables/");
        var width = 1800;
        var height = 1500;
        browser.driver.manage().window().setSize(width, height);
    }
    )
        it('Task1', function() {
         
          element(by.xpath("//button[@class='btn btn-link pull-right']")).click();
          //verify add user text
          var foo1 = element(by.xpath("//div[@class='modal-header']/h3"));
          expect(foo1.getText()).toEqual('Add User');
          //add User info
          var testerName= "tester_nbs_cdk";
          element(by.xpath("//td[@class='ng-scope']/input[@name='FirstName']")).sendKeys(testerName);
          element(by.xpath("//td[@class='ng-scope']/input[@name='LastName']")).sendKeys("tester");
          element(by.xpath("//td[@class='ng-scope']/input[@name='UserName']")).sendKeys("tester_nbs_cdk");
          element(by.xpath("//td[@class='ng-scope']/input[@name='Password']")).sendKeys("1234567");
          //Select the Radio button
          var radioBtn = element(by.xpath("//label/input[@value='15']"));
          //verifying after and before selecting the Radio button
          radioBtn.isSelected().then(radioBtnSelected =>{
            console.log('Is the radio button Selected',radioBtnSelected);
          })
          radioBtn.click();
          radioBtn.isSelected().then(radioBtnSelected =>{
            console.log('Is the radio button Selected',radioBtnSelected);
          })
  
          //Select drop down
          element(by.xpath("//td/select[@name='RoleId']")).element(by.css("option[value='2']")).click();
         // element.all(by.options("c.Value as c.Text for c in column.options")).get(2).click();
         element(by.xpath("//td/input[@name='Email']")).sendKeys("tester@gmail.com");element(by.xpath("//td/input[@name='Email']")).sendKeys("tester@gmail.com");
         element(by.xpath("//td/input[@name='Mobilephone']")).sendKeys("03342838882");
         element(by.xpath("//div/button/following-sibling::button[@class='btn btn-success']")).click();
  
          //verify added User
          //var foo = element(by.xpath("//tbody/tr[1]/td[contains(text(),'"+testerName+"')][1]"));
          //expect(foo.getText()).toEqual(testerName);
        });
  
        it('Task 2', function() {
          //verify User Name
          var foo = element(by.xpath("//tbody/tr/following::tr/following::tr/td[contains(text(),'Mark')]"));
          expect(foo.getText()).toEqual('Mark');
  
          //Edit Specific User and Verify updated value
          element(by.xpath("//tbody/tr[3]/td[10]/button[contains(text(),'Edit')]")).click();
         var firstName = element(by.xpath("//td[@class='ng-scope']/input[@name='FirstName']"));
         firstName.clear();
         firstName.sendKeys("Updated MarK")
  
         element(by.xpath("//div/button/following-sibling::button[@class='btn btn-success']")).click();
         //browser.sleep(5000);
        //verify Updated User
         // var foo = element(by.xpath("//tbody/tr[4]/td[1][contains(text(),'Updated MarK')]"));
        //  expect(foo.getText()).toEqual("Updated MarK");
          //browser.sleep(5000);
        });
        
        afterEach(function(){
          console.log("TestCases Executed Successfully");
  
        });
        });