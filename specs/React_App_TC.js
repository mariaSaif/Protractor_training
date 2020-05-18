
describe('Protractor Demo App', function() {
    beforeEach(function(){
        browser.manage().window().maximize();
        browser.driver.ignoreSynchronization = true
        browser.get('https://www.kayak.com/hotels');
      
    });
  
      it('Verify Page title', function() {
          
        var title = browser.getTitle(); 
        expect(title).toEqual('Hotels: Find Cheap Hotel Deals & Discounts - KAYAK');
          });
  
       it('Verify KAYAK Logo', function() {
        var logo  = element(by.xpath("//a[contains(@id,'logo') and contains(@aria-label,'KAYAK logo')]"));
        expect(logo.isPresent()).toBe(true);
        });

        it('click on hotels link', function() {
            element(by.linkText("Hotels")).click();
            });

        it('Verify if Origin field is present', function() {
            var OriginField  = element.all(by.css('._iVhselectTextOnFocus')).get(0);
            expect(OriginField.isPresent()).toBe(true);
                });

       it('Verify if text 1 room, 2 guests is present', function() {
          text  = element(by.xpath("//div[@class='keel-grid v-c-p ']/div[@class='col _irH']/div[@class='keel-grid ']/div[contains(text(),'1 room, 2 guests')]"));
         console.log("print text", + text);
         expect(text.getText()).toEqual('1 room, 2 guests');
            });
        it('Start Date Field present', function() {
             var text  = element.all(by.css('.input._ihh._idE._jlv._id7._ial._ii0._iQj._iaj._isn._iso')).get(0);
             expect(text.isPresent()).toBe(true);
             });
        it('End Date Field present', function() {
                var text  = element.all(by.css('.input._ihh._idE._jlv._id7._ial._ii0._iQj._iaj._isn._iso')).get(1)
                expect(text.isPresent()).toBe(true);
                });

        it('End Date Field present', function() {
            var text  = element.all(by.css('.input._ihh._idE._jlv._id7._ial._ii0._iQj._iaj._isn._iso')).get(1)
                  expect(text.isPresent()).toBe(true);
                  });

            
  
        afterEach(function(){
          console.log("TestCases Executed Successfully");
        });
        });