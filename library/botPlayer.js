var http = require('http');
var request = require('request');
var Events = require("events").EventEmitter;

var PriorityGrid = require('./priorityGridLib.js');

const HOST = 'localhost';
const PORT = 5000;

var emitter = new Events();

var bodyParser = function(res, next) {
    var data = '';
    res.on('data', function(chunk) {
        data += chunk;
    });
    res.on('end', function() {
        data = JSON.parse(data);
        res.body = data;
        next();
    });
};

var BotPlayer = function(gameId) {
    var grid = new PriorityGrid();
    this.http = http;
    this.name = 'name=BotPlayer';
    this.cookie = 'Id=' + gameId;
    this.grid = grid;
};

BotPlayer.prototype.start = function() {
    var self = this;
    var options = {
        hostname: HOST,
        port: PORT,
        path: '/html/index.html',
        method: 'POST'
    };
    var req = this.http.request(options, function(res) {
        if (res.statusCode == 302) {
            console.log('Registered');
            self.name = res.headers['set-cookie'].toString();
            emitter.emit('joinGame', self);
        }
    });
    req.write(self.name);
    req.end();
};

var getUpdates = function(caller){
	var options = {
        hostname: HOST,
        port: PORT,
        path: '/html/get_updates',
        headers: {
            'Cookie': caller.cookie
        }
    };
    caller.name = caller.cookie.split(';')[1].split('=')[1];
    var req = http.request(options,function(res){
    	var sucess = function(){
    		var updates = res.body;
    		if(updates.turn == caller.name)
                emitter.emit('shoot',caller);
            if(updates.gameEnd!==null)
            	process.exit(0);
    	};
    	bodyParser(res, sucess);
    });
    req.end();
}

emitter.on('joinGame', function(caller) {
    var options = {
        hostname: HOST,
        port: PORT,
        path: '/html/joinGame',
        method: 'POST',
        headers: {
            'Cookie': caller.name
        }
    };
    var req = caller.http.request(options, function(res) {
        if (res.statusCode == 302) {
            console.log('Joined Game');
            caller.cookie = res.headers['set-cookie'].toString().replace('Path=/,', '');
            caller.cookie = caller.cookie.replace('Path=/', '');
            emitter.emit('deploy', caller);
            return;
        }
    });
    req.write(caller.cookie);
    req.end();
});

var ships = {
    battleship: ['E3', 'E4', 'E5', 'E6'],
    carrier: ['C6', 'C7', 'C8', 'C9', 'C10'],
    cruiser: ['H5', 'I5', 'J5'],
    destroyer: ['G7', 'H7'],
    submarine: ['A1', 'A2', 'A3']
}

emitter.on('deploy', function(caller) {
    var counter = 0;
    var options = {
        hostname: HOST,
        port: PORT,
        path: '/html/deployShip',
        method: 'POST',
        headers: {
            'Cookie': caller.cookie
        }
    };
    for (var ship in ships) {
        var req = caller.http.request(options, function(res) {
        var sucess = function() {
            counter++;
            var data = res.body;
            if (data != true)
                console.log('Can Not Deploy', data);
            if (counter == 5)
                emitter.emit('sayReady', caller, res.headers);
        }
        bodyParser(res, sucess);
        });
        var postion = 'name=' + ship + '&positions=' + ships[ship].join(' ');
        console.log(postion);
        req.write(postion);
        req.end();
    }
});

emitter.on('sayReady', function(caller) {
    var options = {
        hostname: HOST,
        port: PORT,
        path: '/html/deploy.html',
        method: 'POST',
        headers: {
            'Cookie': caller.cookie
        }
    };
    var req = caller.http.request(options, function(res) {
        if (res.statusCode == 302) {
            console.log('Announced Ready');
            setInterval(getUpdates.bind(null,caller),2000);
        }
    });
    req.write(caller.cookie);
    req.end();
});

emitter.on('shoot',function(caller){
	var current = caller.grid.getPosition();
	console.log(current);
	var options = {
        hostname: HOST,
        port: PORT,
        path: '/html/shoot',
        method: 'POST',
        headers: {
            'Cookie': caller.cookie
        }
    };
    var req = caller.http.request(options, function(res) {
    	var sucess = function(){
    		caller.grid.setResult(current,res.body);
    	};
        bodyParser(res, sucess);
    });
    var postion = 'position='+current.key;
    req.write(postion);
    req.end();
});

var b = new BotPlayer(102);
b.start();
