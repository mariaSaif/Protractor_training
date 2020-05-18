var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcb55f21b52c89f828bff490a378596a",
        "instanceId": 14772,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00c200db-00cb-0034-00fd-006e006400a0.png",
        "timestamp": 1589540636993,
        "duration": 7623
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcb55f21b52c89f828bff490a378596a",
        "instanceId": 14772,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00fb00dd-00b3-00df-0037-000400a200d3.png",
        "timestamp": 1589540645490,
        "duration": 2982
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcb55f21b52c89f828bff490a378596a",
        "instanceId": 14772,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007000b5-00f6-0074-0099-000700ee00f4.png",
        "timestamp": 1589540648812,
        "duration": 5174
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bcb55f21b52c89f828bff490a378596a",
        "instanceId": 14772,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "008c00ca-005e-0078-0081-00810009006e.png",
        "timestamp": 1589540654348,
        "duration": 1512
    },
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5653b4adbecd58ff6798b5165f647823",
        "instanceId": 13936,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0024008d-006c-007e-00ac-009a00dd002f.png",
        "timestamp": 1589541398035,
        "duration": 7748
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5653b4adbecd58ff6798b5165f647823",
        "instanceId": 13936,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "0067004e-00ba-0038-00de-006d00da0005.png",
        "timestamp": 1589541406169,
        "duration": 3125
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5653b4adbecd58ff6798b5165f647823",
        "instanceId": 13936,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "009e00c3-00db-00c4-0062-00080001008f.png",
        "timestamp": 1589541409609,
        "duration": 5845
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5653b4adbecd58ff6798b5165f647823",
        "instanceId": 13936,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00160007-0016-0021-0090-001400ba00f5.png",
        "timestamp": 1589541415870,
        "duration": 1638
    },
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3eb080c2e2bc324d7efb6a257f62d4c1",
        "instanceId": 21468,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: angularLoginpage is not defined",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "ReferenceError: angularLoginpage is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:5)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:13:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Login /Logout over angular application\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "008500f0-0005-0085-0002-009300360095.png",
        "timestamp": 1589541982339,
        "duration": 61
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3eb080c2e2bc324d7efb6a257f62d4c1",
        "instanceId": 21468,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: angularLoginpage is not defined",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "ReferenceError: angularLoginpage is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:5)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:25:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify error message on incorrect credentials\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:24:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "004c00cb-00c7-00f2-00a4-0036003c00f0.png",
        "timestamp": 1589541982760,
        "duration": 35
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3eb080c2e2bc324d7efb6a257f62d4c1",
        "instanceId": 21468,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "004a00a0-00a5-0028-0057-00b300010042.png",
        "timestamp": 1589541983075,
        "duration": 8320
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3eb080c2e2bc324d7efb6a257f62d4c1",
        "instanceId": 21468,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001500e3-000e-0095-0082-0046005b0099.png",
        "timestamp": 1589541991768,
        "duration": 1480
    },
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c6e75d4a4ff25c8c77388af5b16e1b7b",
        "instanceId": 12476,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: LoginPage.get is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LoginPage.get is not a function\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:15)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:13:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Login /Logout over angular application\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ef0039-003b-003e-0016-001e004400e5.png",
        "timestamp": 1589542107718,
        "duration": 81
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c6e75d4a4ff25c8c77388af5b16e1b7b",
        "instanceId": 12476,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: LoginPage.get is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LoginPage.get is not a function\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:15)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:25:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify error message on incorrect credentials\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:24:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "002700ca-006d-0091-005a-00ca00be0033.png",
        "timestamp": 1589542108156,
        "duration": 40
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c6e75d4a4ff25c8c77388af5b16e1b7b",
        "instanceId": 12476,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: chrome not reachable\n  (Session info: chrome=81.0.4044.138)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'LAPTOP-105', ip: '192.168.99.1', os.name: 'Windows 10', os.arch: 'amd64', os.version: '10.0', java.version: '1.8.0_121'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: chrome not reachable\n  (Session info: chrome=81.0.4044.138)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'LAPTOP-105', ip: '192.168.99.1', os.name: 'Windows 10', os.arch: 'amd64', os.version: '10.0', java.version: '1.8.0_121'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //button[@class='btn btn-link pull-right'])\n    at thenableWebDriverProxy.schedule (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:11:75)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Task1\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:9:9)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "timestamp": 1589542108505,
        "duration": 34767
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c6e75d4a4ff25c8c77388af5b16e1b7b",
        "instanceId": 12476,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: chrome not reachable\n  (Session info: chrome=81.0.4044.138)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'LAPTOP-105', ip: '192.168.99.1', os.name: 'Windows 10', os.arch: 'amd64', os.version: '10.0', java.version: '1.8.0_121'\nDriver info: driver.version: unknown",
            "Failed: chrome not reachable\n  (Session info: chrome=81.0.4044.138)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'LAPTOP-105', ip: '192.168.99.1', os.name: 'Windows 10', os.arch: 'amd64', os.version: '10.0', java.version: '1.8.0_121'\nDriver info: driver.version: unknown"
        ],
        "trace": [
            "WebDriverError: chrome not reachable\n  (Session info: chrome=81.0.4044.138)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'LAPTOP-105', ip: '192.168.99.1', os.name: 'Windows 10', os.arch: 'amd64', os.version: '10.0', java.version: '1.8.0_121'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: WebDriver.navigate().to(data:text/html,<html></html>)\n    at thenableWebDriverProxy.schedule (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at thenableWebDriverProxy.get (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:673:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:2:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "WebDriverError: chrome not reachable\n  (Session info: chrome=81.0.4044.138)\nBuild info: version: '3.141.59', revision: 'e82be7d358', time: '2018-11-14T08:25:53'\nSystem info: host: 'LAPTOP-105', ip: '192.168.99.1', os.name: 'Windows 10', os.arch: 'amd64', os.version: '10.0', java.version: '1.8.0_121'\nDriver info: driver.version: unknown\n    at Object.checkLegacyResponse (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Protractor.waitForAngular() - Locator: By(xpath, //tbody/tr/following::tr/following::tr/td[contains(text(),'Mark')])\n    at thenableWebDriverProxy.schedule (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at ProtractorBrowser.executeAsyncScript_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:423:28)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:454:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as getText] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as getText] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:47:22)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Task 2\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:44:9)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-webtables_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "timestamp": 1589542155328,
        "duration": 24070
    },
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "52a263dc711b8a3d2e8f102f1048e9a8",
        "instanceId": 10868,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: LoginPage.get is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LoginPage.get is not a function\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:15)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:13:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Login /Logout over angular application\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "004500c0-00b2-005a-0010-009b0094001b.png",
        "timestamp": 1589542494105,
        "duration": 54
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "52a263dc711b8a3d2e8f102f1048e9a8",
        "instanceId": 10868,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: LoginPage.get is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LoginPage.get is not a function\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:15)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:25:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify error message on incorrect credentials\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:24:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:3:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "001e0031-00eb-0067-0014-00c300bc00a1.png",
        "timestamp": 1589542494485,
        "duration": 30
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "52a263dc711b8a3d2e8f102f1048e9a8",
        "instanceId": 10868,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00640046-00ba-005c-00fd-00a5008f003c.png",
        "timestamp": 1589542494808,
        "duration": 8635
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "52a263dc711b8a3d2e8f102f1048e9a8",
        "instanceId": 10868,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007500af-0011-008c-0018-0015007a0097.png",
        "timestamp": 1589542503860,
        "duration": 1689
    },
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "46bbe12048b1d59d7d99d0c905352594",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: LoginPage.get is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LoginPage.get is not a function\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:6:15)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:14:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Login /Logout over angular application\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:12:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "0086000f-0012-00fb-00a8-006f00240017.png",
        "timestamp": 1589543148499,
        "duration": 110
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "46bbe12048b1d59d7d99d0c905352594",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: LoginPage.get is not a function",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "TypeError: LoginPage.get is not a function\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:6:15)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:5:3)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Verify error message on incorrect credentials\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:25:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\JS-Login_TC.js:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00b40003-00b6-00a6-0031-005e003a00b8.png",
        "timestamp": 1589543149015,
        "duration": 31
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "46bbe12048b1d59d7d99d0c905352594",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ff00b7-00ec-005f-00c9-001200f2009a.png",
        "timestamp": 1589543149362,
        "duration": 22622
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "46bbe12048b1d59d7d99d0c905352594",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b1009b-0052-00e7-00c9-007a004e000e.png",
        "timestamp": 1589543172594,
        "duration": 2282
    },
    {
        "description": "Login /Logout over angular application|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1b290098c342354c36a06225f467998",
        "instanceId": 18756,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "007a00bc-000b-0027-004e-0059007b0006.png",
        "timestamp": 1589543468458,
        "duration": 7255
    },
    {
        "description": "Verify error message on incorrect credentials|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1b290098c342354c36a06225f467998",
        "instanceId": 18756,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "001100e7-001d-00e8-00c1-002700a20098.png",
        "timestamp": 1589543476519,
        "duration": 2959
    },
    {
        "description": "Task1|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1b290098c342354c36a06225f467998",
        "instanceId": 18756,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00ab003a-0065-00d5-00e4-00a8007200c3.png",
        "timestamp": 1589543479828,
        "duration": 5112
    },
    {
        "description": "Task 2|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e1b290098c342354c36a06225f467998",
        "instanceId": 18756,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "005f0039-0051-0098-00ce-00bc006200ca.png",
        "timestamp": 1589543485308,
        "duration": 1468
    },
    {
        "description": "should calc with operator -|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "b107df4a259599fdc57055d00b3f5ddd",
        "instanceId": 11760,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:6:26)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator -\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:5:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:3:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00f3004c-000f-00bc-003e-003d00b00023.png",
        "timestamp": 1589545902727,
        "duration": 8
    },
    {
        "description": "should calc with operator -|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "b107df4a259599fdc57055d00b3f5ddd",
        "instanceId": 11760,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:6:26)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator -\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:5:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:3:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00be00af-0044-0027-0043-0086008c00c7.png",
        "timestamp": 1589545903090,
        "duration": 2
    },
    {
        "description": "should calc with operator -|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fdd20bb48e45c5da084bbdc2618b2280",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:6:26)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator -\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:5:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:3:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "0002008c-00e2-0019-00a0-00750068001a.png",
        "timestamp": 1589545979978,
        "duration": 10
    },
    {
        "description": "should calc with operator -|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fdd20bb48e45c5da084bbdc2618b2280",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:6:26)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator -\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:5:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:3:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c200dc-0000-0054-00e0-005b009600f7.png",
        "timestamp": 1589545980393,
        "duration": 3
    },
    {
        "description": "should calc with operator +|test addition with data provider - provider function|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fdd20bb48e45c5da084bbdc2618b2280",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:23:30)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator +\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:22:13\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:21:9)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "0012000b-0069-00fc-008f-00ae00e6008b.png",
        "timestamp": 1589545980698,
        "duration": 3
    },
    {
        "description": "should calc with operator +|test addition with data provider - provider function|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fdd20bb48e45c5da084bbdc2618b2280",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:23:30)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator +\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:22:13\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:21:9)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00cb0092-0051-000a-007e-003e006d002f.png",
        "timestamp": 1589545981007,
        "duration": 2
    },
    {
        "description": "should calc with operator +|test addition with data provider - provider function|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fdd20bb48e45c5da084bbdc2618b2280",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:23:30)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator +\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:22:13\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:21:9)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ce0046-00f6-0086-008e-0021004800ea.png",
        "timestamp": 1589545981331,
        "duration": 4
    },
    {
        "description": "should calc with operator +|test addition with data provider - provider function|test subtraction with data provider - direct array",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "fdd20bb48e45c5da084bbdc2618b2280",
        "instanceId": 17992,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: calculator is not defined"
        ],
        "trace": [
            "ReferenceError: calculator is not defined\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:23:30)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"should calc with operator +\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:22:13\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:25:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:20:20\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:21:9)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00a400b7-0028-0012-00b6-008100cd0096.png",
        "timestamp": 1589545981636,
        "duration": 2
    },
    {
        "description": "Twitter found for Andrew Owen|find Modus twitter accounts",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "0cfd8bb0fdc7dda4ad4189b65211c723",
        "instanceId": 19396,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be truthy 'Employee not found'.",
            "Expected false to be truthy 'Employee does not have twitter linked'.",
            "Failed: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/modusAndrew\"])"
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:14:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:17:105)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "NoSuchElementError: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/modusAndrew\"])\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:20:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Twitter found for Andrew Owen\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:13:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:37:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:30:24\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:1)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://moduscreate.com/wp-content/plugins/wp-code-prettify/css/1 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1589546811264,
                "type": ""
            }
        ],
        "screenShotFile": "00c40003-00a8-00fd-0059-009c002a001d.png",
        "timestamp": 1589546807093,
        "duration": 9360
    },
    {
        "description": "Twitter found for Steve Dalgetty|find Modus twitter accounts",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "0cfd8bb0fdc7dda4ad4189b65211c723",
        "instanceId": 19396,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be truthy 'Employee not found'.",
            "Expected false to be truthy 'Employee does not have twitter linked'.",
            "Failed: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/stevedalgetty\"])"
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:14:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:17:105)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "NoSuchElementError: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/stevedalgetty\"])\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:20:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Twitter found for Steve Dalgetty\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:13:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:37:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:30:24\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:1)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://moduscreate.com/wp-content/plugins/wp-code-prettify/css/1 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1589546818136,
                "type": ""
            }
        ],
        "screenShotFile": "00b300fe-00a6-00c6-0031-00f000930048.png",
        "timestamp": 1589546817286,
        "duration": 2901
    },
    {
        "description": "Twitter found for Dave Ackerman|find Modus twitter accounts",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "0cfd8bb0fdc7dda4ad4189b65211c723",
        "instanceId": 19396,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be truthy 'Employee not found'.",
            "Expected false to be truthy 'Employee does not have twitter linked'.",
            "Failed: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/dmackerman\"])"
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:14:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:17:105)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "NoSuchElementError: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/dmackerman\"])\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:20:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Twitter found for Dave Ackerman\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:13:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:37:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:30:24\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:1)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://moduscreate.com/wp-content/plugins/wp-code-prettify/css/1 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1589546821341,
                "type": ""
            }
        ],
        "screenShotFile": "00c10072-00b1-0073-00d4-00ac0041001a.png",
        "timestamp": 1589546820694,
        "duration": 2742
    },
    {
        "description": "Twitter found for Fake Jay Garcia|find Modus twitter accounts",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "0cfd8bb0fdc7dda4ad4189b65211c723",
        "instanceId": 19396,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be truthy 'Employee not found'.",
            "Expected false to be truthy 'Employee does not have twitter linked'.",
            "Failed: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/notjaygarcia\"])"
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:14:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:17:105)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7",
            "NoSuchElementError: No element found using locator: By(css selector, a[href=\"http://www.twitter.com/notjaygarcia\"])\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:20:85)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Twitter found for Fake Jay Garcia\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:13:9\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:37:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:30:24\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:11:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:4:1)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://moduscreate.com/wp-content/plugins/wp-code-prettify/css/1 - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1589546824508,
                "type": ""
            }
        ],
        "screenShotFile": "007b0038-0087-0050-005a-002200320073.png",
        "timestamp": 1589546823978,
        "duration": 2118
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "42b12e4b199ab23726b8bbf4b19ff0ba",
        "instanceId": 2028,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: add_user_pom_element is not defined"
        ],
        "trace": [
            "ReferenceError: add_user_pom_element is not defined\n    at Object.addUser (D:\\Proractor-workspace\\Assignment1\\specs\\Helper.js:23:5)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:14:11)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"should add a user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:13:6\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:37:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:30:24\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:12:6)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:5:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "006e007d-00f3-00c3-00c4-00bc00e600dd.png",
        "timestamp": 1589547028420,
        "duration": 2766
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "42b12e4b199ab23726b8bbf4b19ff0ba",
        "instanceId": 2028,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: add_user_pom_element is not defined"
        ],
        "trace": [
            "ReferenceError: add_user_pom_element is not defined\n    at Object.addUser (D:\\Proractor-workspace\\Assignment1\\specs\\Helper.js:23:5)\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:14:11)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"should add a user\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:13:6\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:37:22\n    at Array.forEach (<anonymous>)\n    at D:\\Proractor-workspace\\Assignment1\\node_modules\\jasmine-data-provider\\src\\index.js:30:24\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:12:6)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\jasmine_DataProvider.js:5:1)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ec006f-00fd-007c-00a3-00d300ef0029.png",
        "timestamp": 1589547031887,
        "duration": 1971
    },
    {
        "description": "should calc with operator -|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5089c2bf34a26f7d3526a8ff38554b51",
        "instanceId": 10760,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00500027-0081-001d-00f3-00b200a20098.png",
        "timestamp": 1589547419890,
        "duration": 2579
    },
    {
        "description": "should calc with operator -|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5089c2bf34a26f7d3526a8ff38554b51",
        "instanceId": 10760,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a70021-0051-0047-0061-0004002d00a4.png",
        "timestamp": 1589547423274,
        "duration": 424
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b5e2d39c8812380cd93abdba68ae91d0",
        "instanceId": 6552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c700e4-0038-00c9-00fa-00ea004800b4.png",
        "timestamp": 1589783018262,
        "duration": 6481
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b5e2d39c8812380cd93abdba68ae91d0",
        "instanceId": 6552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "000000ee-006d-007f-0047-00aa000e00df.png",
        "timestamp": 1589783025371,
        "duration": 2963
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dc2b1f1782a3bb906435de5bd0df4e03",
        "instanceId": 8212,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002100ae-006c-00d0-0076-00c3001f0010.png",
        "timestamp": 1589783125234,
        "duration": 6081
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dc2b1f1782a3bb906435de5bd0df4e03",
        "instanceId": 8212,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00440097-00d8-001e-00b8-001f009600f9.png",
        "timestamp": 1589783131694,
        "duration": 2358
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "6a715e54463d3d02e6cc7ee40a47f872",
        "instanceId": 15776,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:2:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Verify Page title\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:9:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589784970297,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://www.kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589784973524,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589784973524,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589784974549,
                "type": ""
            }
        ],
        "screenShotFile": "004900c0-00d9-00b5-00ec-006b002c006b.png",
        "timestamp": 1589784965375,
        "duration": 16890
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "54ff0dbad6f20fd6e99c835d6abfe273",
        "instanceId": 19848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:2:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Verify Page title\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:9:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://www.kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785042011,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589785043081,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785047214,
                "type": ""
            }
        ],
        "screenShotFile": "007b0009-0052-0084-00c5-00c400ef00a5.png",
        "timestamp": 1589785037279,
        "duration": 15611
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3e9b0f0e3c608e7105d157b3064e43c5",
        "instanceId": 17848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:2:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Verify Page title\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:9:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://www.kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785120214,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589785121290,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785126746,
                "type": ""
            }
        ],
        "screenShotFile": "00510070-006e-00da-00e3-004100960090.png",
        "timestamp": 1589785115421,
        "duration": 15802
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "409b6227f8f1c5de9a313c1d3cbfb8f7",
        "instanceId": 12644,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:2:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Verify Page title\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:9:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://www.kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785413461,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589785414329,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785417736,
                "type": ""
            }
        ],
        "screenShotFile": "00a800ef-00e3-00d4-0080-005000d60085.png",
        "timestamp": 1589785408281,
        "duration": 15492
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "01a9d95e03bec19925b42af8404d3364",
        "instanceId": 20780,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Failed: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load",
            "Failed: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\""
        ],
        "trace": [
            "Error: Angular could not be found on the page https://www.kayak.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run beforeEach in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:2:5)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)",
            "Error: Error while waiting for Protractor to sync with the page: \"both angularJS testability and angular testability are undefined.  This could be either because this is a non-angular page or because your test involves client-side navigation, which can interfere with Protractor's bootstrapping.  See http://git.io/v4gXM for details\"\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:461:23\n    at ManagedPromise.invokeCallback_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Verify Page title\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at Function.next.fail (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4274:9)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:9:7)\n    at addSpecsToSuite (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:1:1)\n    at Module._compile (internal/modules/cjs/loader.js:1151:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1171:10)\n    at Module.load (internal/modules/cjs/loader.js:1000:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:899:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://www.kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785467582,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589785468669,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589785472539,
                "type": ""
            }
        ],
        "screenShotFile": "00d30020-0062-00c2-00a6-00f4002d00c7.png",
        "timestamp": 1589785461802,
        "duration": 16526
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "07fd779b05a0a2b3b4648d36003eb761",
        "instanceId": 15172,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589785641774,
                "type": ""
            }
        ],
        "screenShotFile": "00dd008b-0037-00c5-006f-0079000b0035.png",
        "timestamp": 1589785634443,
        "duration": 8669
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "dbe0fdabb3182080de351f2072abb46f",
        "instanceId": 21216,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected 'Search Flights, Hotels & Rental Cars | KAYAK' to equal 'Hotels: Find Cheap Hotel Deals & Discounts - KAYAK'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:12:23)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788689633,
                "type": ""
            }
        ],
        "screenShotFile": "00e600d4-001f-0022-00c0-002800e7005a.png",
        "timestamp": 1589788683884,
        "duration": 7362
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dbe0fdabb3182080de351f2072abb46f",
        "instanceId": 21216,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://www.kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589788692171,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/ - A cookie associated with a cross-site resource at http://kayak.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589788692171,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788693388,
                "type": ""
            }
        ],
        "screenShotFile": "006d0074-0007-00f9-00a0-0066007d0015.png",
        "timestamp": 1589788691764,
        "duration": 1676
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dbe0fdabb3182080de351f2072abb46f",
        "instanceId": 21216,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788696046,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788697843,
                "type": ""
            }
        ],
        "screenShotFile": "005b0089-00f6-00b7-000f-001000df00f8.png",
        "timestamp": 1589788694106,
        "duration": 3838
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e19c5e861f656d0e996856a6be0bd941",
        "instanceId": 18232,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected 'Cheap Flights, Airline Tickets & Airfare Deals | KAYAK' to equal 'Hotels: Find Cheap Hotel Deals & Discounts - KAYAK'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:12:23)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [],
        "screenShotFile": "00dd00b9-004d-0064-0040-0069000d000c.png",
        "timestamp": 1589788768105,
        "duration": 8357
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e19c5e861f656d0e996856a6be0bd941",
        "instanceId": 18232,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788776845,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788780261,
                "type": ""
            }
        ],
        "screenShotFile": "00a3009b-0078-0036-00d2-009e00700020.png",
        "timestamp": 1589788777362,
        "duration": 2935
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e19c5e861f656d0e996856a6be0bd941",
        "instanceId": 18232,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788783971,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589788785282,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788787705,
                "type": ""
            }
        ],
        "screenShotFile": "0060008c-008e-0068-0047-00ad002d002f.png",
        "timestamp": 1589788781108,
        "duration": 7462
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "add380e90c51cae34939558036995685",
        "instanceId": 3220,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788925671,
                "type": ""
            }
        ],
        "screenShotFile": "00490009-002a-0008-000f-007f00f800df.png",
        "timestamp": 1589788919358,
        "duration": 10944
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "add380e90c51cae34939558036995685",
        "instanceId": 3220,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788933063,
                "type": ""
            }
        ],
        "screenShotFile": "0049000d-009d-0015-0045-0039009600e4.png",
        "timestamp": 1589788930799,
        "duration": 2293
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "add380e90c51cae34939558036995685",
        "instanceId": 3220,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589788934678,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788936915,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.googletagservices.com/tag/js/gpt.js 5 The PerformanceObserver does not support buffered flag with the entryTypes argument.",
                "timestamp": 1589788938869,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589788939342,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589788940564,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589788940596,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589788940598,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589788940649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589788940651,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589788940654,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589788940684,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589788940684,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589788940684,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589788940684,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589788940684,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589788940685,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589788940686,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589788940688,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589788940689,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589788940691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589788940704,
                "type": ""
            }
        ],
        "screenShotFile": "0066003b-003f-00ab-0065-00ac000100bd.png",
        "timestamp": 1589788933792,
        "duration": 6762
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "85b83b7488a2981fc88afee15289da63",
        "instanceId": 6192,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00b3000a-0067-00da-0093-003300bb0038.png",
        "timestamp": 1589789208484,
        "duration": 6612
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "85b83b7488a2981fc88afee15289da63",
        "instanceId": 6192,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589789215711,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at https://r.3gl.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589789216341,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at https://r.3gl.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589789217594,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589789218540,
                "type": ""
            }
        ],
        "screenShotFile": "004e0078-0011-0061-00b7-000e008d0083.png",
        "timestamp": 1589789216011,
        "duration": 2953
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "85b83b7488a2981fc88afee15289da63",
        "instanceId": 6192,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589789223841,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at https://r.3gl.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589789225370,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589789226878,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.googletagservices.com/tag/js/gpt.js 5 The PerformanceObserver does not support buffered flag with the entryTypes argument.",
                "timestamp": 1589789228409,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589789228709,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at https://r.3gl.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589789228733,
                "type": ""
            }
        ],
        "screenShotFile": "0012007a-00f4-00ee-001a-0026007f0009.png",
        "timestamp": 1589789222923,
        "duration": 5828
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790588862,
                "type": ""
            }
        ],
        "screenShotFile": "007f0083-0076-0081-00ea-00e6007a004b.png",
        "timestamp": 1589790581544,
        "duration": 9178
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589790592132,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790595451,
                "type": ""
            }
        ],
        "screenShotFile": "00fb004f-007e-0067-0096-0033008d00fe.png",
        "timestamp": 1589790591550,
        "duration": 3932
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589790596694,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790598512,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790600307,
                "type": ""
            }
        ],
        "screenShotFile": "008b00f4-00b4-0001-003f-00d0007800ee.png",
        "timestamp": 1589790596160,
        "duration": 5100
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589790601462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589790601578,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589790601599,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589790601600,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589790601704,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589790601705,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589790601706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589790601706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589790601706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589790601706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589790601706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589790601706,
                "type": ""
            }
        ],
        "screenShotFile": "00830037-0040-00b4-00c5-0085003300e0.png",
        "timestamp": 1589790601816,
        "duration": 1831
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:31:38)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790603815,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589790604871,
                "type": ""
            }
        ],
        "screenShotFile": "00e900b0-00ee-006c-00d4-00bf006c0076.png",
        "timestamp": 1589790604599,
        "duration": 1784
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:35:39)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790606451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589790607429,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589790607697,
                "type": ""
            }
        ],
        "screenShotFile": "004f00c4-00c2-00d4-00d2-00f400bc002a.png",
        "timestamp": 1589790607204,
        "duration": 3491
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "3227444dce4fac5bea07e7670f3ad7ff",
        "instanceId": 1964,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:39:42)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589790610881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589790611981,
                "type": ""
            }
        ],
        "screenShotFile": "00fc00cd-00bd-0078-0086-00ce00a800ea.png",
        "timestamp": 1589790611488,
        "duration": 3528
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791451903,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791453832,
                "type": ""
            }
        ],
        "screenShotFile": "00b20046-00f6-0049-00b7-00e700850030.png",
        "timestamp": 1589791445629,
        "duration": 8777
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791455050,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791456912,
                "type": ""
            }
        ],
        "screenShotFile": "00aa003c-0024-00a6-00e1-0043006000bb.png",
        "timestamp": 1589791454901,
        "duration": 2078
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791457186,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791458024,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791460602,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791460822,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791462456,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791462562,
                "type": ""
            }
        ],
        "screenShotFile": "00c500d0-00d6-00eb-00ed-006d00630073.png",
        "timestamp": 1589791458308,
        "duration": 5056
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791464173,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791464191,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791464192,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791464236,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791464238,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791464242,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791464252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791464253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791464257,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791464264,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791464270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791464272,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791464272,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791464273,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791464274,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791464275,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791464284,
                "type": ""
            }
        ],
        "screenShotFile": "009700a4-0063-00bf-0001-00c1000900b2.png",
        "timestamp": 1589791463769,
        "duration": 1565
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791465490,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791465566,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791466345,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791468208,
                "type": ""
            }
        ],
        "screenShotFile": "00c70091-00ad-0087-006d-005b005b005e.png",
        "timestamp": 1589791466048,
        "duration": 2192
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:35:39)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791468374,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791469231,
                "type": ""
            }
        ],
        "screenShotFile": "00510031-00bc-0003-0005-00090028003a.png",
        "timestamp": 1589791468995,
        "duration": 1989
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "5443e1de9b7522b3983900eeedd1287d",
        "instanceId": 6528,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:39:42)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791471046,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/flights - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791471197,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791472010,
                "type": ""
            }
        ],
        "screenShotFile": "006d008e-0026-00bc-0037-000a008c0035.png",
        "timestamp": 1589791471516,
        "duration": 1898
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected 'Hotels: Find Cheap Hotel Deals & Discounts - KAYAK' to equal 'Cheap Flights, Airline Tickets & Airfare Deals | KAYAK'."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:12:23)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791525974,
                "type": ""
            }
        ],
        "screenShotFile": "00190091-00b8-0004-0069-00a500bc007a.png",
        "timestamp": 1589791519955,
        "duration": 7988
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791528841,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791530372,
                "type": ""
            }
        ],
        "screenShotFile": "007800c0-0067-006f-004a-002600c8003d.png",
        "timestamp": 1589791528444,
        "duration": 1965
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791530681,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791532817,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791533082,
                "type": ""
            }
        ],
        "screenShotFile": "00ce00e2-005b-0062-0080-00fb00000030.png",
        "timestamp": 1589791531070,
        "duration": 2659
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791534293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791534302,
                "type": ""
            }
        ],
        "screenShotFile": "004f00b3-00d5-00a5-009f-002b0008004a.png",
        "timestamp": 1589791534581,
        "duration": 1048
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791535811,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791535901,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791536541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791536559,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791536560,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791536599,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791536600,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791536603,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791536612,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791536613,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791536616,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791536621,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791536626,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791536627,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791536627,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791536629,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791536630,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791536631,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791536643,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791537750,
                "type": ""
            }
        ],
        "screenShotFile": "00520048-0095-0014-00eb-00710012002c.png",
        "timestamp": 1589791536209,
        "duration": 1549
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791537863,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791538461,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791538474,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791538475,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791538512,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791538513,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791538517,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791538526,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791538530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791538533,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791538535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791538542,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791538543,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791538544,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791538545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791538546,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791538548,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791538559,
                "type": ""
            }
        ],
        "screenShotFile": "000700a7-0000-0009-008b-00f70062006c.png",
        "timestamp": 1589791538302,
        "duration": 1342
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ff673ffb9040182b02a8d30d89780c32",
        "instanceId": 13924,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589791539947,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791540197,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791541463,
                "type": ""
            }
        ],
        "screenShotFile": "001a00b1-0013-003b-00b9-00e30097000b.png",
        "timestamp": 1589791540183,
        "duration": 1297
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791603294,
                "type": ""
            }
        ],
        "screenShotFile": "004f0051-00f1-003e-0053-00fa002d005e.png",
        "timestamp": 1589791597144,
        "duration": 9510
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791609503,
                "type": ""
            }
        ],
        "screenShotFile": "002c0079-00ea-00eb-0065-00b300160055.png",
        "timestamp": 1589791607277,
        "duration": 2177
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791610338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791610362,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791610364,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791610420,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791610421,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791610425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791610448,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791610451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791610451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791610451,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791610452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791610452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791610454,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791610455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791610457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791610458,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791610474,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791612756,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791613452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791613466,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791613467,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791613510,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791613512,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791613516,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791613528,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791613537,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791613537,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791613539,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791613543,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791613545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791613545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791613547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791613550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791613551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791613558,
                "type": ""
            }
        ],
        "screenShotFile": "00a900a6-0036-003a-0051-00ab00d400de.png",
        "timestamp": 1589791610276,
        "duration": 3829
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791614507,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791615099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791615113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791615115,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791615172,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791615174,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791615187,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791615214,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791615216,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791615218,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791615220,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791615225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791615227,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791615228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791615229,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791615232,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791615233,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791615241,
                "type": ""
            }
        ],
        "screenShotFile": "00b90070-00b9-001a-001b-0037001200e2.png",
        "timestamp": 1589791614760,
        "duration": 1208
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791616121,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791616773,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791616786,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791616787,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791616819,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791616823,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791616825,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791616837,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791616838,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791616843,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791616844,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791616849,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791616850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791616859,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791616863,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791616864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791616866,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791616872,
                "type": ""
            }
        ],
        "screenShotFile": "00c5007a-007a-0062-0008-004e003000e0.png",
        "timestamp": 1589791616727,
        "duration": 1427
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791618785,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791620103,
                "type": ""
            }
        ],
        "screenShotFile": "00e30013-00e3-0027-006d-003600f200f7.png",
        "timestamp": 1589791618617,
        "duration": 1502
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e0f2b23c8f86da2e8f51dfba73e0677c",
        "instanceId": 8292,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589791621058,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589791621072,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589791621072,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589791621114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589791621114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589791621116,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589791621127,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589791621129,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589791621132,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589791621133,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589791621138,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589791621140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589791621142,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589791621143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589791621145,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589791621146,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589791621155,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589791622202,
                "type": ""
            }
        ],
        "screenShotFile": "00c200d8-00f7-00b8-00c7-009100fe00ab.png",
        "timestamp": 1589791620914,
        "duration": 1309
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792050243,
                "type": ""
            }
        ],
        "screenShotFile": "00be0094-0050-0050-00ce-00a8008e00a1.png",
        "timestamp": 1589792044528,
        "duration": 7566
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792053030,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792053046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792053047,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792053086,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792053087,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792053092,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792053103,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792053104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792053107,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792053113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792053116,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792053118,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792053119,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792053120,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792053122,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792053123,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792053134,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792054879,
                "type": ""
            }
        ],
        "screenShotFile": "00890016-00e9-00ac-00ca-002300000086.png",
        "timestamp": 1589792052602,
        "duration": 2261
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792055600,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792055615,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792055616,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792055656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792055656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792055660,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792055674,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792055675,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792055678,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792055680,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792055685,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792055686,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792055687,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792055690,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792055691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792055692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792055701,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792057765,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792058302,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792058325,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792058325,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792058375,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792058377,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792058384,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792058407,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792058412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792058415,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792058415,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792058422,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792058423,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792058423,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792058425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792058425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792058426,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792058435,
                "type": ""
            }
        ],
        "screenShotFile": "009700f2-003e-00bc-0085-00c7000f006a.png",
        "timestamp": 1589792055834,
        "duration": 3083
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792059443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792060185,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792060194,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792060195,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792060224,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792060225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792060227,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792060244,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792060244,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792060245,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792060246,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792060251,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792060252,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792060253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792060254,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792060255,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792060256,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792060265,
                "type": ""
            }
        ],
        "screenShotFile": "008100c5-007d-00cf-0029-003a00270026.png",
        "timestamp": 1589792059849,
        "duration": 1374
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792061390,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792062155,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792062168,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792062169,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792062206,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792062207,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792062212,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792062224,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792062225,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792062228,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792062232,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792062236,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792062240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792062240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792062241,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792062243,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792062244,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792062254,
                "type": ""
            }
        ],
        "screenShotFile": "0027001c-0014-0057-0026-00b0003c0031.png",
        "timestamp": 1589792061889,
        "duration": 1835
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792063967,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792064571,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792064586,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792064587,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792064624,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792064625,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792064628,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792064646,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792064647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792064647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792064647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792064652,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792064654,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792064655,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792064656,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792064657,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792064658,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792064667,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792065085,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792066109,
                "type": ""
            }
        ],
        "screenShotFile": "00a30076-0006-0001-003a-00ab005900df.png",
        "timestamp": 1589792064383,
        "duration": 1753
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "217702735e3dc5c4b37c131b667b1e29",
        "instanceId": 7516,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792066301,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792066965,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792066965,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792066965,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792066996,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792066998,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792067002,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792067015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792067015,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792067017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792067024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792067026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792067027,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792067028,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792067030,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792067032,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792067033,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792067049,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792068431,
                "type": ""
            }
        ],
        "screenShotFile": "00e40074-004c-00aa-0096-00bc000200ac.png",
        "timestamp": 1589792066947,
        "duration": 1502
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792123776,
                "type": ""
            }
        ],
        "screenShotFile": "003a00e5-0032-0083-00d1-004e00ca0028.png",
        "timestamp": 1589792116831,
        "duration": 9036
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792126737,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792126757,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792126758,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792126795,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792126796,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792126801,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792126814,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792126816,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792126822,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792126826,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792126833,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792126834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792126834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792126834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792126835,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792126836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792126848,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792126976,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792127981,
                "type": ""
            }
        ],
        "screenShotFile": "00db0060-006f-0002-00d1-0088009c00c0.png",
        "timestamp": 1589792126458,
        "duration": 1530
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792128761,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792128785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792128785,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792128832,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792128833,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792128836,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792128847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792128853,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792128858,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792128858,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792128867,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792128868,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792128868,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792128869,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792128870,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792128872,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792128877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792130666,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792130833,
                "type": ""
            }
        ],
        "screenShotFile": "004b0018-009f-00d6-00f4-005d003300e7.png",
        "timestamp": 1589792128723,
        "duration": 3140
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792132485,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792132610,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792133289,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792133302,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792133304,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792133344,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792133345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792133348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792133362,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792133362,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792133364,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792133366,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792133372,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792133374,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792133375,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792133376,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792133377,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792133378,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792133388,
                "type": ""
            }
        ],
        "screenShotFile": "00a900e7-007e-00a2-0048-00a200430082.png",
        "timestamp": 1589792132902,
        "duration": 1274
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792134454,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792134691,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792136355,
                "type": ""
            }
        ],
        "screenShotFile": "00c10054-0055-009e-000a-004200d00056.png",
        "timestamp": 1589792134670,
        "duration": 1655
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792136430,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792137237,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792137254,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792137255,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792137287,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792137288,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792137292,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792137323,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792137324,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792137332,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792137334,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792137343,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792137343,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792137345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792137346,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792137347,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792137349,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792137357,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792138783,
                "type": ""
            }
        ],
        "screenShotFile": "0006009d-002d-006f-00aa-003b00d7002b.png",
        "timestamp": 1589792137187,
        "duration": 1608
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "1f99b18222d0609425ce859f46b1cd35",
        "instanceId": 13552,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792138904,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792139618,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792139637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792139639,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792139678,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792139680,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792139684,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792139692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792139693,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792139694,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792139696,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792139702,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792139703,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792139704,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792139704,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792139706,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792139707,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792139716,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792141111,
                "type": ""
            }
        ],
        "screenShotFile": "00ab0007-009d-0022-005e-009300880046.png",
        "timestamp": 1589792139548,
        "duration": 1578
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00a90095-00e8-0092-00cd-00dc00c200ac.png",
        "timestamp": 1589792319596,
        "duration": 5900
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792326154,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792327941,
                "type": ""
            }
        ],
        "screenShotFile": "007500ac-005c-00e3-00fe-0091007700b0.png",
        "timestamp": 1589792326138,
        "duration": 1961
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792329367,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792329392,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792329392,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792329440,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792329441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792329445,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792329461,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792329462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792329465,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792329467,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792329474,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792329475,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792329476,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792329478,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792329479,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792329481,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792329494,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792331600,
                "type": ""
            }
        ],
        "screenShotFile": "00aa003c-00c2-0029-001d-0014005700e2.png",
        "timestamp": 1589792329787,
        "duration": 2862
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792333184,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792333931,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792333949,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792333952,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792333996,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792333997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792334002,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792334024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792334032,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792334034,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792334035,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792334039,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792334041,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792334042,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792334045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792334047,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792334049,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792334060,
                "type": ""
            }
        ],
        "screenShotFile": "00cb00b6-00f7-00a2-00a2-0034004e00e8.png",
        "timestamp": 1589792333615,
        "duration": 1892
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792335671,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792336334,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792336352,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792336353,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792336386,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792336387,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792336390,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792336401,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792336404,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792336405,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792336412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792336415,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792336417,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792336418,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792336419,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792336420,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792336421,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792336431,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792336937,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792338063,
                "type": ""
            }
        ],
        "screenShotFile": "00410084-00d0-000d-002d-00fe004c00c0.png",
        "timestamp": 1589792336563,
        "duration": 1510
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792338192,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792338975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792339043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792339045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792339083,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792339085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792339088,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792339104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792339104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792339105,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792339107,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792339112,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792339114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792339116,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792339118,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792339119,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792339121,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792339135,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792340235,
                "type": ""
            }
        ],
        "screenShotFile": "00ba0099-00b6-00cb-0052-002c00730039.png",
        "timestamp": 1589792338749,
        "duration": 1496
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "aae6bcd23bff8acebd439d543f5323be",
        "instanceId": 9320,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792340387,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792341053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792341054,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792341054,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792341082,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792341082,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792341086,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792341097,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792341098,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792341100,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792341102,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792341110,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792341111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792341113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792341114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792341116,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792341117,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792341128,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792342502,
                "type": ""
            }
        ],
        "screenShotFile": "00c900b6-0064-0022-0004-00c100490094.png",
        "timestamp": 1589792341043,
        "duration": 1477
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [],
        "screenShotFile": "00020091-0063-0077-0000-00f8001600c3.png",
        "timestamp": 1589792425146,
        "duration": 5982
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792431553,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.googletagservices.com/tag/js/gpt.js 5 The PerformanceObserver does not support buffered flag with the entryTypes argument.",
                "timestamp": 1589792431553,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792433494,
                "type": ""
            }
        ],
        "screenShotFile": "00f900fa-0091-00fc-00ee-003500550068.png",
        "timestamp": 1589792431912,
        "duration": 1710
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792434563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792434584,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792434585,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792434645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792434645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792434652,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792434682,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792434682,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792434682,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792434683,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792434691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792434691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792434691,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792434692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792434692,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792434693,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792434712,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792436936,
                "type": ""
            }
        ],
        "screenShotFile": "00680083-001d-00da-008f-000700f300b7.png",
        "timestamp": 1589792434921,
        "duration": 2919
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792438852,
                "type": ""
            }
        ],
        "screenShotFile": "002900ca-00ae-0077-00e5-006b00c10080.png",
        "timestamp": 1589792438619,
        "duration": 1983
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792440657,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792441482,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792441497,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792441500,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792441530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792441532,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792441535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792441545,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792441546,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792441552,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792441553,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792441562,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792441562,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792441563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792441565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792441566,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792441567,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792441575,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792442596,
                "type": ""
            }
        ],
        "screenShotFile": "005400a8-004a-00c2-003b-00db00af00e8.png",
        "timestamp": 1589792441129,
        "duration": 1476
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792443501,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792443521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792443522,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792443559,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792443561,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792443564,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792443575,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792443576,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792443578,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792443582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792443586,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792443588,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792443589,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792443590,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792443591,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792443592,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792443602,
                "type": ""
            }
        ],
        "screenShotFile": "008d009e-00f7-00f2-00ec-00d100f30006.png",
        "timestamp": 1589792443378,
        "duration": 1274
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "073ec06e1789b586d5540feccf37c4f0",
        "instanceId": 11700,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792444792,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792445582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792445596,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792445597,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792445633,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792445635,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792445637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792445648,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792445650,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792445652,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792445654,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792445659,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792445660,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792445662,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792445664,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792445665,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792445666,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792445676,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792446008,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792447013,
                "type": ""
            }
        ],
        "screenShotFile": "003f00dd-0097-0008-00bb-00b400bb00ed.png",
        "timestamp": 1589792445539,
        "duration": 1514
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792569832,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792571822,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792571842,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792571843,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792571912,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792571917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792571922,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792571938,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792571943,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792571945,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792571945,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792571955,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792571957,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792571959,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792571961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792571962,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792571964,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792571979,
                "type": ""
            }
        ],
        "screenShotFile": "0057003a-00f9-00d1-008b-009700eb00f7.png",
        "timestamp": 1589792563942,
        "duration": 8431
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792572999,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792574375,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792574495,
                "type": ""
            }
        ],
        "screenShotFile": "00f80078-0022-00ab-0085-00a0000e0086.png",
        "timestamp": 1589792572941,
        "duration": 1534
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792575314,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792575323,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792575324,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792575384,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792575386,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792575389,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792575402,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792575403,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792575405,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792575407,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792575412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792575414,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792575417,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792575417,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792575418,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792575419,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792575426,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792576877,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792577051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792577561,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792577581,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792577582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792577619,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792577624,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792577626,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792577636,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792577637,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792577639,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792577641,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792577645,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792577647,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792577649,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792577650,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792577652,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792577653,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792577662,
                "type": ""
            }
        ],
        "screenShotFile": "00ec00cc-0047-00c7-00dc-00200092008f.png",
        "timestamp": 1589792575126,
        "duration": 2982
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:26:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792578656,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792578752,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792579381,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792579392,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792579393,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792579424,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792579425,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792579429,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792579444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792579447,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792579448,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792579450,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792579454,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792579455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792579457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792579459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792579461,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792579463,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792579472,
                "type": ""
            }
        ],
        "screenShotFile": "009700c1-002e-0001-0025-009b00060048.png",
        "timestamp": 1589792579059,
        "duration": 1163
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792580365,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792580472,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792580969,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792580997,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792580998,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792581040,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792581041,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792581044,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792581055,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792581057,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792581074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792581074,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792581082,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792581082,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792581085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792581085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792581085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792581090,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792581097,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792582587,
                "type": ""
            }
        ],
        "screenShotFile": "004a0096-0036-0078-00f9-005300140020.png",
        "timestamp": 1589792580925,
        "duration": 1646
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792582703,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792583468,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792583481,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792583482,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792583520,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792583521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792583524,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792583535,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792583543,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792583550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792583550,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792583551,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792583552,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792583554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792583555,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792583557,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792583558,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792583567,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792584604,
                "type": ""
            }
        ],
        "screenShotFile": "006700d7-009c-00f9-002c-0072000b0071.png",
        "timestamp": 1589792583288,
        "duration": 1337
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8648a1baf76c7ef4a270e8b2a7bbcd54",
        "instanceId": 19576,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589792584733,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589792585489,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589792585504,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589792585505,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589792585547,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589792585548,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589792585552,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589792585562,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589792585563,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589792585565,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589792585567,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589792585571,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589792585572,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589792585573,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589792585574,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589792585576,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589792585577,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589792585586,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589792586877,
                "type": ""
            }
        ],
        "screenShotFile": "00fd0082-00b8-001a-002c-0001001700d8.png",
        "timestamp": 1589792585461,
        "duration": 1404
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796368653,
                "type": ""
            }
        ],
        "screenShotFile": "000100fd-005e-0098-0056-0076001e0052.png",
        "timestamp": 1589796360927,
        "duration": 8980
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589796371521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589796371521,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589796371522,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589796371522,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589796371522,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589796371522,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589796371523,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589796371523,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589796371523,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589796371523,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589796371523,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589796371523,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589796371524,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589796371524,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589796371524,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589796371524,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589796371524,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796371943,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796373259,
                "type": ""
            }
        ],
        "screenShotFile": "0077006b-0055-00a6-0047-00b500230081.png",
        "timestamp": 1589796371479,
        "duration": 1849
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796374085,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589796374317,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589796374338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589796374338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589796374381,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589796374382,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589796374386,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589796374421,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589796374441,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589796374443,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589796374446,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589796374452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589796374454,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589796374456,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589796374458,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589796374460,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589796374462,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589796374473,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796376639,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796377359,
                "type": ""
            }
        ],
        "screenShotFile": "001d00f1-0014-0097-00c2-0052005b002b.png",
        "timestamp": 1589796374237,
        "duration": 3503
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:27:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796378340,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796378948,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589796379094,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589796379112,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589796379114,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589796379150,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589796379152,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589796379156,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589796379167,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589796379168,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589796379175,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589796379176,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589796379181,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589796379186,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589796379186,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589796379187,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589796379189,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589796379190,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589796379199,
                "type": ""
            }
        ],
        "screenShotFile": "008400cd-00ad-00be-00dc-000a004e0043.png",
        "timestamp": 1589796378787,
        "duration": 1394
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796380353,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796381043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589796381065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589796381082,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589796381083,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589796381118,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589796381119,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589796381121,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589796381131,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589796381136,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589796381136,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589796381138,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589796381148,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589796381148,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589796381148,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589796381150,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589796381151,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589796381153,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589796381159,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796382839,
                "type": ""
            }
        ],
        "screenShotFile": "000c00a1-0057-007f-000f-00ea00d30016.png",
        "timestamp": 1589796381027,
        "duration": 1824
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796383583,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589796383739,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589796383755,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589796383756,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589796383793,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589796383795,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589796383799,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589796383816,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589796383817,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589796383820,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589796383826,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589796383831,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589796383832,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589796383834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589796383835,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589796383837,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589796383838,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589796383848,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796385365,
                "type": ""
            }
        ],
        "screenShotFile": "00b70030-0023-00b1-0009-00e300db0016.png",
        "timestamp": 1589796383702,
        "duration": 1684
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4fa34f0048ec1db10b5c7ad912e1e54f",
        "instanceId": 2676,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589796386026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589796386381,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589796386399,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589796386400,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589796386438,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589796386440,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589796386445,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589796386455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589796386455,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589796386457,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589796386459,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589796386465,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589796386466,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589796386467,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589796386468,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589796386469,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589796386470,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589796386479,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589796387918,
                "type": ""
            }
        ],
        "screenShotFile": "00b800e7-00bb-00cf-00a5-00ed009300d8.png",
        "timestamp": 1589796386272,
        "duration": 1711
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797441273,
                "type": ""
            }
        ],
        "screenShotFile": "00600059-0089-0078-00b8-007d00f20050.png",
        "timestamp": 1589797435345,
        "duration": 7916
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589797444062,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589797444081,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589797444082,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589797444138,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589797444139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589797444143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589797444170,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589797444170,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589797444171,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589797444171,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589797444177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589797444177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589797444177,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589797444178,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589797444179,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589797444180,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589797444196,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797444291,
                "type": ""
            }
        ],
        "screenShotFile": "00ee00ed-00b4-000d-004f-00a100e30085.png",
        "timestamp": 1589797444440,
        "duration": 1887
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797446397,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797446515,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589797447202,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589797447218,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589797447219,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589797447248,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589797447249,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589797447253,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589797447267,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589797447269,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589797447272,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589797447275,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589797447279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589797447280,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589797447281,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589797447282,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589797447284,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589797447286,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589797447293,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797449005,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797449126,
                "type": ""
            }
        ],
        "screenShotFile": "007700af-009b-0085-0022-00c100ff00f4.png",
        "timestamp": 1589797446913,
        "duration": 3030
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:27:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797450464,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797450596,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589797451331,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589797451345,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589797451346,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589797451378,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589797451380,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589797451383,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589797451397,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589797451399,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589797451402,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589797451404,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589797451408,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589797451409,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589797451410,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589797451411,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589797451412,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589797451414,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589797451421,
                "type": ""
            }
        ],
        "screenShotFile": "00c80092-00c9-00dd-007e-0021002c0030.png",
        "timestamp": 1589797450913,
        "duration": 1192
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797452272,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797452366,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589797453061,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589797453071,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589797453072,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589797453107,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589797453108,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589797453112,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589797453128,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589797453128,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589797453130,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589797453136,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589797453139,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589797453140,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589797453143,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589797453155,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589797453155,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589797453156,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589797453162,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797454308,
                "type": ""
            }
        ],
        "screenShotFile": "005400cc-0053-00b5-0080-007f004c0005.png",
        "timestamp": 1589797452712,
        "duration": 1579
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797454412,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797456140,
                "type": ""
            }
        ],
        "screenShotFile": "008700ed-009e-0001-00a9-00a7006c0054.png",
        "timestamp": 1589797454825,
        "duration": 1349
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797456279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589797457039,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589797457051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589797457053,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589797457087,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589797457088,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589797457090,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589797457099,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589797457100,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589797457102,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589797457104,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589797457107,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589797457109,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589797457110,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589797457111,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589797457112,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589797457113,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589797457120,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797458438,
                "type": ""
            }
        ],
        "screenShotFile": "00ad003b-0053-004a-00ca-00f6005000c6.png",
        "timestamp": 1589797456979,
        "duration": 1444
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "12f24d9a79ad2ef42832306a24799a0b",
        "instanceId": 14660,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589797458546,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589797459223,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589797459242,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589797459244,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589797459277,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589797459278,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589797459280,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589797459290,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589797459291,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589797459293,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589797459295,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589797459300,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589797459301,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589797459302,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589797459303,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589797459305,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589797459306,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589797459313,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.googletagservices.com/tag/js/gpt.js 5 The PerformanceObserver does not support buffered flag with the entryTypes argument.",
                "timestamp": 1589797460534,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589797460686,
                "type": ""
            }
        ],
        "screenShotFile": "00ba0073-00f0-0009-00dc-007100a500df.png",
        "timestamp": 1589797459148,
        "duration": 1561
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "71d2ae7212acff98da18e72a1dab5911",
        "instanceId": 3708,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c800be-008c-00f2-0012-003c002f003c.png",
        "timestamp": 1589797561174,
        "duration": 4967
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "71d2ae7212acff98da18e72a1dab5911",
        "instanceId": 3708,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007700cb-0063-004e-001a-006800710032.png",
        "timestamp": 1589797566533,
        "duration": 2467
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f8c80b7ab8200cad1dea06dd6bfd7950",
        "instanceId": 10096,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b600b0-0032-0021-00d3-005400bd00d9.png",
        "timestamp": 1589799334958,
        "duration": 4656
    },
    {
        "description": "should add a user|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f8c80b7ab8200cad1dea06dd6bfd7950",
        "instanceId": 10096,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001d009e-00d6-00a0-00a1-00290053003f.png",
        "timestamp": 1589799340018,
        "duration": 1839
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799375739,
                "type": ""
            }
        ],
        "screenShotFile": "00700031-00f4-0085-002d-00d2007300ec.png",
        "timestamp": 1589799368207,
        "duration": 8967
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799379662,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589799380711,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589799380740,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589799380742,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589799380800,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589799380802,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589799380808,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589799380826,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589799380834,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589799380840,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589799380842,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589799380847,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589799380848,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589799380853,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589799380857,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589799380864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589799380865,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589799380882,
                "type": ""
            }
        ],
        "screenShotFile": "00de00e9-0021-00d6-00b7-00df005f003c.png",
        "timestamp": 1589799377881,
        "duration": 3276
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589799381430,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.googletagservices.com/tag/js/gpt.js 5 The PerformanceObserver does not support buffered flag with the entryTypes argument.",
                "timestamp": 1589799383633,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799384220,
                "type": ""
            }
        ],
        "screenShotFile": "00450033-00fe-00d6-0085-0083002f0089.png",
        "timestamp": 1589799381829,
        "duration": 3081
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\Assignment1\\specs\\React_App_TC.js:27:45)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at C:\\Users\\maria.saif\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799385488,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589799385892,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589799386221,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589799386238,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589799386239,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589799386278,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589799386279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589799386282,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589799386294,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589799386297,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589799386299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589799386301,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589799386308,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589799386308,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589799386310,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589799386311,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589799386312,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589799386313,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589799386321,
                "type": ""
            }
        ],
        "screenShotFile": "0078001e-0033-00a9-0087-003e00ae0062.png",
        "timestamp": 1589799385763,
        "duration": 1387
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799387337,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589799388092,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799389263,
                "type": ""
            }
        ],
        "screenShotFile": "00dd007b-00b1-001a-00bd-00a7004e0093.png",
        "timestamp": 1589799387763,
        "duration": 1487
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589799389864,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589799389953,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589799389968,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589799389969,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589799390002,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589799390003,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589799390007,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589799390016,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589799390017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589799390019,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589799390021,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589799390026,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589799390027,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589799390028,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589799390030,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589799390031,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589799390032,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589799390040,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799391440,
                "type": ""
            }
        ],
        "screenShotFile": "003a004a-00e8-0081-009c-00ef002e00d9.png",
        "timestamp": 1589799389847,
        "duration": 1602
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589799391861,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589799392248,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589799392266,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589799392266,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589799392308,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589799392310,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589799392315,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589799392325,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589799392327,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589799392329,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589799392331,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589799392336,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589799392337,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589799392338,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589799392339,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589799392340,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589799392342,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589799392351,
                "type": ""
            }
        ],
        "screenShotFile": "000a0090-0058-00b4-00df-00e400c900cb.png",
        "timestamp": 1589799392203,
        "duration": 2291
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "48e8289c5070314745369ac6d8fc33da",
        "instanceId": 17048,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799394591,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589799395398,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589799396621,
                "type": ""
            }
        ],
        "screenShotFile": "006f00e3-000e-0090-00ef-005b002b00f5.png",
        "timestamp": 1589799394956,
        "duration": 1642
    },
    {
        "description": "Verify Page title|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804600133,
                "type": ""
            }
        ],
        "screenShotFile": "0069007b-00e4-009c-0077-004c006b00c6.png",
        "timestamp": 1589804593262,
        "duration": 9461
    },
    {
        "description": "Verify KAYAK Logo|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589804602920,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589804602950,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589804602950,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589804603001,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589804603003,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589804603006,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589804603024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589804603025,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589804603025,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589804603031,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589804603038,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589804603039,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589804603039,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589804603041,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589804603043,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589804603044,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589804603059,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804603787,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804605342,
                "type": ""
            }
        ],
        "screenShotFile": "0021001e-00dc-0075-0032-005e002f00c8.png",
        "timestamp": 1589804603663,
        "duration": 1622
    },
    {
        "description": "click on hotels link|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589804606227,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589804606240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589804606240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589804606305,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589804606313,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589804606316,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589804606330,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589804606331,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589804606334,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589804606337,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589804606348,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589804606350,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589804606351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589804606353,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589804606355,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589804606357,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589804606369,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804606816,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804608383,
                "type": ""
            }
        ],
        "screenShotFile": "00320015-009f-0025-007e-00dc0003004a.png",
        "timestamp": 1589804606207,
        "duration": 3507
    },
    {
        "description": "Verify if Origin field is present|Protractor Demo App",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": [
            "Expected false to be true."
        ],
        "trace": [
            "Error: Failed expectation\n    at UserContext.<anonymous> (D:\\Proractor-workspace\\protractor_training\\specs\\React_App_TC.js:27:45)\n    at D:\\Proractor-workspace\\protractor_training\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (D:\\Proractor-workspace\\protractor_training\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (D:\\Proractor-workspace\\protractor_training\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (D:\\Proractor-workspace\\protractor_training\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (D:\\Proractor-workspace\\protractor_training\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (D:\\Proractor-workspace\\protractor_training\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at D:\\Proractor-workspace\\protractor_training\\node_modules\\selenium-webdriver\\lib\\promise.js:2974:25\n    at D:\\Proractor-workspace\\protractor_training\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804610410,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804611204,
                "type": ""
            }
        ],
        "screenShotFile": "000f0040-006d-0076-00d0-001b002300f0.png",
        "timestamp": 1589804610826,
        "duration": 1536
    },
    {
        "description": "Verify if text 1 room, 2 guests is present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804612449,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589804613181,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589804613196,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589804613197,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589804613241,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589804613243,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589804613245,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589804613263,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589804613264,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589804613266,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589804613270,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589804613276,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589804613278,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589804613279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589804613281,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589804613282,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589804613283,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589804613292,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804613443,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804614859,
                "type": ""
            }
        ],
        "screenShotFile": "00060032-00cc-005d-00c9-001300620003.png",
        "timestamp": 1589804613077,
        "duration": 1756
    },
    {
        "description": "Start Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589804615757,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589804615850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589804615850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589804615979,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589804615980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589804616003,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589804616029,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589804616029,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589804616034,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589804616035,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589804616048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589804616065,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589804616069,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589804616069,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589804616070,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589804616070,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589804616116,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804616316,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804618106,
                "type": ""
            }
        ],
        "screenShotFile": "00650030-005d-0052-00b6-00d000db0047.png",
        "timestamp": 1589804616712,
        "duration": 1405
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589804618965,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589804618980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589804618980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589804619017,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589804619018,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589804619022,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589804619033,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589804619033,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589804619035,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589804619040,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589804619045,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589804619046,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589804619047,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589804619048,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589804619050,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589804619051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589804619061,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804619182,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804620246,
                "type": ""
            }
        ],
        "screenShotFile": "003400a4-0020-004b-00c1-000a005600cc.png",
        "timestamp": 1589804618714,
        "duration": 1512
    },
    {
        "description": "End Date Field present|Protractor Demo App",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "00968cef206db221939dcbfd10daaa12",
        "instanceId": 3848,
        "browser": {
            "name": "chrome",
            "version": "81.0.4044.138"
        },
        "message": "Passed.",
        "trace": "",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotel-rooms-selected' is being overwritten.\"",
                "timestamp": 1589804620905,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_searchType' is being overwritten.\"",
                "timestamp": 1589804620917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'hotels_results_locationId' is being overwritten.\"",
                "timestamp": 1589804620917,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_freebies_state' is being overwritten.\"",
                "timestamp": 1589804620960,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_stars_state' is being overwritten.\"",
                "timestamp": 1589804620961,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_extendedrating_state' is being overwritten.\"",
                "timestamp": 1589804620963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price_state' is being overwritten.\"",
                "timestamp": 1589804620975,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelname_state' is being overwritten.\"",
                "timestamp": 1589804620976,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_hotelchain_state' is being overwritten.\"",
                "timestamp": 1589804620983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_location_state' is being overwritten.\"",
                "timestamp": 1589804620983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_neighborhoods_state' is being overwritten.\"",
                "timestamp": 1589804620989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_amenities_state' is being overwritten.\"",
                "timestamp": 1589804620989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_ambiance_state' is being overwritten.\"",
                "timestamp": 1589804620991,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_property_state' is being overwritten.\"",
                "timestamp": 1589804620992,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_price-options_state' is being overwritten.\"",
                "timestamp": 1589804620994,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'filters_providers_state' is being overwritten.\"",
                "timestamp": 1589804620995,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"Duplicate question name 'SearchFailed_isNoResultsStatus' is being overwritten.\"",
                "timestamp": 1589804621004,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.kayak.com/hotels - A cookie associated with a cross-site resource at http://a.cdn.intentmedia.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1589804621172,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://www.googletagservices.com/tag/js/gpt.js 5 The PerformanceObserver does not support buffered flag with the entryTypes argument.",
                "timestamp": 1589804622099,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://content.r9cdn.net/res/combined.js?v=223642b44501c03c1d49968ca3bfdbcac8d343dd&cluster=5 0:74181 \"This API is deprecated and will be shutdown on 6/30/2020.\\n\\nPlease migrate to the new One Tap API at https://developers.google.com/identity/one-tap/web as soon as possible.\"",
                "timestamp": 1589804622492,
                "type": ""
            }
        ],
        "screenShotFile": "006c00c4-002f-002a-0023-00e500fb0032.png",
        "timestamp": 1589804620812,
        "duration": 1782
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
