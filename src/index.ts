import * as mp from './msgpack';
import { Duplex } from 'stream';
function checkCrc(data: Buffer) {
	return ((data[3] + data[4] + data[5] + data[6] + data[7]) & 0xff) == data[8];
}
export class packStream extends Duplex {
	constructor() {
		super({ objectMode: true });
	}
	_read() {}
	_write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
		let type = 0;
		let i = 0;
		let tmp = mp.encode(chunk);
		let buf = Buffer.alloc(9 + tmp.length);
		buf[i++] = 0x00;
		buf[i++] = 0x00;
		buf[i++] = 0x01;
		buf[i++] = tmp.length >> 24;
		buf[i++] = tmp.length >> 16;
		buf[i++] = tmp.length >> 8;
		buf[i++] = tmp.length;
		buf[i++] = type;
		buf[i++] = buf[3] + buf[4] + buf[5] + buf[6] + buf[7];
		buf.set(tmp, 9);
		this.push(buf);
		callback();
	}
}
export class unpackStream extends Duplex {
	private _tmp: Buffer;
	private _len: number = 0;
	private _end: number = 0;
	private _type: number = 0;
	private _buf: Buffer;
	constructor() {
		super({ objectMode: true });
	}

	_read() {}
	_write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
		this.checkData(chunk);
		while (this.next()) {
			this.push(mp.decode(this._buf));
		}
		callback();
	}
	checkData(data: Buffer) {
		let tmp: Buffer;
		switch (data.constructor.name) {
			case 'Buffer':
				tmp = data;
				break;
			case 'ArrayBuffer':
				tmp = new Buffer(data);
				break;
			case 'String':
				tmp = new Buffer(data);
				break;
			default:
				if (data.length) {
					tmp = new Buffer(data);
				} else {
					tmp = new Buffer(typeof data);
				}
				break;
		}

		if (this._tmp) {
			this._tmp = Buffer.concat([ this._tmp, new Buffer(tmp) ]);
		} else {
			this._tmp = tmp;
		}
	}
	checkHead() {
		var sp = 2;
		if (this._tmp.length < 9) {
			return false;
		}
		while (sp < this._tmp.length) {
			switch (this._tmp[sp]) {
				case 0:
					if (this._tmp[sp - 1] != 0) {
						sp += 2;
						break;
					} else {
						sp += 1;
						break;
					}
					break;
				case 1:
					if (this._tmp[sp - 1] != 0 || this._tmp[sp - 2] != 0) {
						sp += 3;
					} else {
						this._tmp = this._tmp.slice(sp - 2);
						return true;
					}
					break;
				default:
					sp += 3;
					break;
			}
		}
		this._tmp = this._tmp.slice(this._tmp.length - 3);
		return false;
	}
	head() {
		if (this._tmp.length > 8) {
			this._len = (this._tmp[3] << 24) + (this._tmp[4] << 16) + (this._tmp[5] << 8) + this._tmp[6];
			this._end = this._len + 9;
			this._type = this._tmp[7];
			return true;
		}
		return false;
	}
	parse() {
		if (this._end > this._tmp.length) {
			return false;
		}
		if (this._end == this._tmp.length) {
			this._buf = this._tmp.slice(9);
			this._tmp = Buffer.alloc(0);
		} else {
			this._buf = this._tmp.slice(9, this._end);
			this._tmp = this._tmp.slice(this._end);
		}

		this._len = 0;
		this._end = 0;
		return true;
	}
	next() {
		while (1) {
			if (!this._tmp) {
				return false;
			}
			if (!this.checkHead()) {
				return false;
			}
			if (!this.head()) {
				return false;
			}
			if (!checkCrc(this._tmp)) {
				this._tmp = this._tmp.slice(3);
				continue;
			}
			if (!this.parse()) {
				return false;
			}
			return true;
		}
	}
}
