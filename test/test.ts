import { packStream, unpackStream } from '../src/index';
import * as net from 'net';
import { Duplex } from 'stream';
class Logic extends Duplex {
	constructor() {
		super({ objectMode: true });
	}
	_read() {}
	_write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
		this.push('hello client!!!');
		callback();
	}
}
let psc = new packStream();
let pss = new packStream();
let upsc = new unpackStream();
let upss = new unpackStream();
let logic = new Logic();

let c = net.connect(8001, '127.0.0.1', function() {
	c.pipe(upsc);
	psc.pipe(c);
	upsc.on('data', (data) => {
		console.log('client:', data);
	});
	psc.write('hello wolrd!!!');
});

var s = net.createServer(function(cli) {
	cli.pipe(upss).pipe(logic).pipe(pss).pipe(cli);
});
s.listen(8001);
