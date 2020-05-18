var HtmlReporter = require('protractor-beautiful-reporter');

exports.config = {
 // directConnect: true,
    seleniumAddress: 'http://localhost:4444/wd/hub',
    specs: [
      //'./specs/**/*.js',
       // 'JS-Login_TC.js',
       // 'JS-webtables_TC.js'
       //'./specs/jasmine_DataProvider.js'
      // './dataProvider/dataProviderExample.js'
       './specs/React_App_TC.js'
],
framework: 'jasmine',

onPrepare: async()=> {
   await browser.waitForAngularEnabled(false);
   browser.driver.ignoreSynchronization = true; 
   
    // Add a screenshot reporter and store screenshots to `/tmp/screenshots`:
    jasmine.getEnv().addReporter(new HtmlReporter({
       baseDirectory: 'Reports/screenshots'
    }).getJasmine2Reporter());
 },
 capabilities: {
   browserName: "chrome",
   chromeOnly:true
   
   }
 


}