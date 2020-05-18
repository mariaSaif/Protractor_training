var using = require('jasmine-data-provider');
var obj = require('../utils/Helper');
var user = require('../utils/dataprovider');

describe('Protractor Demo App', function() {
 

     beforeEach(function() {
      browser.get('http://www.way2automation.com/angularjs-protractor/webtables/');
     });

     using(user.userInfo, function (data) {
     it('should add a user',function(){
      obj.addUser(data.first_name,data.last_name,data.user_name,data.user_password,data.index_value,data.user_role,data.user_email,data.user_phone);
     });  
    });
    /*Use of data provider */
    //    using([{a: 5, b: 2, expected: 3}, {a: 25, b: 26, expected: -1}], function (data) {
    //       it('should calc with operator -', function () {
            
    //           var result =(data.a - data.b);
    //              expect(result).toEqual(data.expected);
    //       });
    //     });
});
  