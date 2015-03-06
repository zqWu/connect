var connect = require('./index.js');

var app = connect();
app.listen(3000);

app.use(function(req, res, next) {
	console.log('exe mid-ware log', req.url);
	// add a mid-ware dynamiclly, 
	app.use(function(req, res, next) {
		console.log('exe mid-ware log2', req.url);
		next();
	});
	next();
});

app.use('/x/yz', function(req, res, next) {
	console.log('exe mid-ware /x/yz', req.url);
	next();
	// res.end('hello, ok' + req.url);
});

app.use('/', function(req, res, next) {
	console.log('exe mid-ware /', req.url);
	// res.end('hello, ok' + req.url);
	next();
});