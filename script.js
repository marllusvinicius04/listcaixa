'use strict';

// QRCode for JavaScript by Kazuhiko Arase, MIT licensed.
const PixQRCode=(()=>{
 const modules={"./QR8bitByte":function(module,require){
var QRMode = require('./QRMode');

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

},
"./QRBitBuffer":function(module,require){
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

},
"./QRErrorCorrectLevel":function(module,require){
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


},
"./QRMaskPattern":function(module,require){
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

},
"./QRMath":function(module,require){
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

},
"./QRMode":function(module,require){
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

},
"./QRPolynomial":function(module,require){
var QRMath = require('./QRMath');

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

},
"./QRRSBlock":function(module,require){
var QRErrorCorrectLevel = require('./QRErrorCorrectLevel');

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

},
"./QRUtil":function(module,require){
var QRMode = require('./QRMode');
var QRPolynomial = require('./QRPolynomial');
var QRMath = require('./QRMath');
var QRMaskPattern = require('./QRMaskPattern');

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

},
"./index":function(module,require){
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = require('./QR8bitByte');
var QRUtil = require('./QRUtil');
var QRPolynomial = require('./QRPolynomial');
var QRRSBlock = require('./QRRSBlock');
var QRBitBuffer = require('./QRBitBuffer');

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

}};
 const loaded={};
 function require(name){
   if(!loaded[name]){
     const module={exports:{}};
     loaded[name]=module;
     modules[name](module,require);
   }
   return loaded[name].exports;
 }
 return require('./index');
})();

;

'use strict';
const $ = id => document.getElementById(id);
const key = 'caixa-rapido-pdv-v2';
const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money = cents => currency.format(cents / 100);
const dateTime = iso => new Date(iso).toLocaleString('pt-BR');
const norm = value => String(value??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const decimal = cents => (cents / 100).toFixed(2).replace('.',',');
const newId = () => Date.now().toString(36)+Math.random().toString(36).slice(2);
function initial(){
 return {catalog:[],sales:[],nextNumber:1,register:null,closed:[],cart:[],discount:0,fiados:[],coupons:[]};
}
let state = initial();
let editing = null;
let candidates = [];
let selectedProductId = null;
let currentReceipt = null;
let justFinishedReceipt = false;
const defaultStore = {storeName:'Caixa Rápido',taxId:'',phone:'',address:'',note:'Obrigado pela preferência!',paper:'80'};
const store = () => ({...defaultStore,...state.store});
function persist(next,removedProductIds){
 if(accessConfig?.blocked) throw new Error('Acesso temporariamente bloqueado.');
 if(window.LC_CLOUD_ERROR) throw new Error('Conexão interrompida. Recarregue para reconectar.');
 if(activeOperatorId){
   const sessions={...state.operatorSessions};
   if(next.register) sessions[activeOperatorId]={register:next.register,cart:next.cart,discount:next.discount,appliedCoupon:next.appliedCoupon};
   else delete sessions[activeOperatorId];
   next={...next,operatorSessions:sessions};
 }
 state=next;
 if(window.LC_CLOUD_READY) window.LC_CLOUD_SAVE(next,removedProductIds,activeOperatorId);
}
function update(patch,removedProductIds){ persist({...state,...patch},removedProductIds); }
function amount(value){
 const clean=value.trim().replace(',','.');
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
 const [whole,fraction='']=clean.split('.');
 return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
function requireAmount(value,positive=false){
 const cents=amount(value);
 if(cents===null || (positive && !cents)) throw new Error(positive?'Informe um valor maior que zero.':'Informe um valor válido em reais.');
 return cents;
}
function node(tag,value,className){
 const result=document.createElement(tag);
 if(value!==undefined) result.textContent=value;
 if(className) result.className=className;
 return result;
}
function button(label,action,className){
 const result=node('button',label,className);
 result.type='button';
 result.addEventListener('click',action);
 return result;
}
function status(message,error=false){
 $('status').textContent=message;
 $('status').classList.toggle('error',error);
}
function form(id,action){
 const target=$(id);
 target.addEventListener('submit',event=>{
   event.preventDefault();
   const error=target.closest('dialog').querySelector('.error');
   error.textContent='';
   try { action(Object.fromEntries(new FormData(target))); }
   catch(problem){ error.textContent=problem.message; }
 });
}
function show(id){
 const dialog=$(id);
 const error=dialog.querySelector('.error');
 if(error) error.textContent='';
 dialog.showModal();
}
$('mainMenu').querySelectorAll('button').forEach(control=>control.addEventListener('click',()=>{$('mainMenu').open=false;}));
document.addEventListener('pointerdown',event=>{
 if(!event.target.closest('#mainMenu')) $('mainMenu').open=false;
});
document.querySelectorAll('[data-close]').forEach(control=>control.onclick=()=>control.closest('dialog').close());

const subtotal = (cart=state.cart) => cart.reduce((sum,item)=>sum+item.qty*item.cents,0);
const total = () => subtotal()-state.discount;
function filterProducts(value){
 const query=norm(value);
 const terms=query.split(/\s+/);
 return state.catalog.filter(product=>{
   if(!query || norm(product.sku).startsWith(query) || norm(product.barcode).startsWith(query)) return true;
   const name=norm(product.name);
   return terms.every(term=>name.includes(term));
 });
}
function available(product){
 return product.stock-(state.cart.find(item=>item.id===product.id)?.qty??0);
}
function positionProductResults(){
 const results=$('products');
 if(results.hidden) return;
 const field=$('search').closest('.searchField').getBoundingClientRect();
 const gap=6, margin=8, preferredHeight=280;
 const width=Math.min(Math.max(field.width,260),window.innerWidth-2*margin);
 const roomBelow=window.innerHeight-field.bottom-gap-margin;
 const roomAbove=field.top-gap-margin;
 const placeAbove=roomBelow<160 && roomAbove>roomBelow;
 results.style.left=Math.max(margin,Math.min(field.left,window.innerWidth-width-margin))+'px';
 results.style.width=width+'px';
 results.style.maxHeight=Math.max(0,Math.min(preferredHeight,placeAbove?roomAbove:roomBelow))+'px';
 results.style.top=placeAbove?'auto':Math.max(margin,field.bottom+gap)+'px';
 results.style.bottom=placeAbove?window.innerHeight-field.top+gap+'px':'auto';
}
function renderProducts(){
 const query=norm($('search').value);
 const results=$('products');
 results.hidden=!window.LC_CLOUD_READY || !query;
 results.replaceChildren();
 candidates=[];
 if(results.hidden) return;
 candidates=filterProducts(query);
 const exact=product=>norm(product.sku)===query || norm(product.barcode)===query;
 candidates.sort((a,b)=>Number(exact(b))-Number(exact(a)) || Number(available(b)>0)-Number(available(a)>0));
 const fragment=document.createDocumentFragment();
 for(const product of candidates){
   const label=node('span',product.name);
   const stock=available(product);
   label.append(node('small',product.sku+' · '+(stock>0?stock+' em estoque':'Sem saldo · ajuste em Produtos e estoque')));
   const control=button('',()=>selectProduct(product),'product');
   control.append(label,node('span',money(product.cents),'value'));
   fragment.append(control);
 }
 results.append(fragment);
 if(!candidates.length) results.append(node('p',state.catalog.length
   ? 'Nenhum produto corresponde à busca.'
   : 'Nenhum produto cadastrado. Abra Produtos e estoque para adicionar um item.','noResults'));
 positionProductResults();
 results.scrollTop=0;
}
function requireRegister(){
 if(!state.register) throw new Error('Abra o caixa para iniciar a venda.');
}
function couponDiscount(coupon,value){
 return Math.round(value*coupon.rate/10000);
}
function setCart(cart){
 const value=subtotal(cart);
 const coupon=cart.length?state.appliedCoupon:null;
 const discount=coupon?couponDiscount(coupon,value):Math.min(state.discount,Math.max(0,value-1));
 update({cart,discount,appliedCoupon:coupon});
 render();
}
function selectProduct(product){
 if(available(product)<=0){
   $('products').hidden=true;
   status(product.name+' está sem saldo. Atualize o estoque em Produtos e estoque.',true);
   return;
 }
 if(!state.register){ $('products').hidden=true; openRegister(); return; }
 selectedProductId=product.id;
 const field=$('quantityForm').elements.quantity;
 field.max=available(product);
 field.value='1';
 $('selectedProduct').textContent=product.name+' · '+money(unitPrice(product))+' por unidade · '+available(product)+' disponíveis';
 updateItemTotal();
 $('products').hidden=true;
 show('quantityDialog');
 field.focus();
 field.select();
}
function unitPrice(product){
 return state.cart.find(item=>item.id===product.id)?.cents??product.cents;
}
function updateItemTotal(){
 const product=state.catalog.find(item=>item.id===selectedProductId);
 const quantity=Number($('quantityForm').elements.quantity.value);
 $('itemTotal').textContent=product && Number.isInteger(quantity) && quantity>0 && quantity<=available(product)?money(unitPrice(product)*quantity):'—';
}
$('quantityForm').elements.quantity.oninput=updateItemTotal;
form('quantityForm',values=>{
 requireRegister();
 const product=state.catalog.find(item=>item.id===selectedProductId);
 const quantity=Number(values.quantity);
 if(!product || !Number.isInteger(quantity) || quantity<1 || quantity>available(product)){
   throw new Error('Informe uma quantidade entre 1 e o saldo disponível.');
 }
 const line=state.cart.find(item=>item.id===product.id);
 const cart=line?state.cart.map(item=>item.id===product.id?{...item,qty:item.qty+quantity}:item):
   [...state.cart,{id:product.id,name:product.name,sku:product.sku,cents:product.cents,qty:quantity}];
 setCart(cart);
 $('search').value='';
 renderProducts();
 $('quantityDialog').close();
 $('search').focus();
 const row=[...$('items').children].find(item=>item.dataset.id===product.id);
 row?.scrollIntoView({block:'nearest'});
 status(quantity+' × '+product.name+' adicionado à venda.');
});
$('quantityDialog').addEventListener('close',()=>{
 if($('search').value.trim()){renderProducts(); $('search').focus();}
});
function changeQty(item,delta){
 try {
   const product=state.catalog.find(p=>p.id===item.id);
   const qty=item.qty+delta;
   if(delta>0 && !item.manual && qty>(product?.stock??0)) throw new Error('Estoque insuficiente.');
   setCart(state.cart.map(line=>line.id===item.id?{...line,qty}:line).filter(line=>line.qty>0));
   const row=[...$('items').children].find(entry=>entry.dataset.id===item.id);
   (row?.querySelector(delta>0?'[data-more]':'[data-less]')??$('search')).focus();
   status('');
 } catch(error){ status(error.message,true); }
}
function render(){
 renderOperators();
 const register=state.register;
 $('registerStatus').textContent=register?'Caixa aberto':'Caixa fechado';
 $('registerStatus').classList.toggle('open',Boolean(register));
 $('operator').textContent=register?'Operador: '+register.operator:'Abra o caixa para registrar vendas.';
 $('openBtn').hidden=Boolean(register);
 $('saleNumber').textContent='Nº '+String(state.nextNumber).padStart(4,'0');
 $('empty').hidden=Boolean(state.cart.length);
 $('items').replaceChildren(...state.cart.map(item=>{
   const row=node('tr');
   row.dataset.id=item.id;
   const name=node('td',item.name);
   name.append(node('small',item.sku));
   const qty=node('td',undefined,'num');
   const group=node('div',undefined,'qty');
   const minus=button('−',()=>changeQty(item,-1));
   minus.dataset.less='';
   minus.setAttribute('aria-label','Diminuir '+item.name);
   const plus=button('+',()=>changeQty(item,1));
   plus.dataset.more='';
   plus.setAttribute('aria-label','Aumentar '+item.name);
   group.append(minus,node('span',item.qty),plus);
   qty.append(group);
   const remove=node('td',undefined,'num');
   const removeButton=button('×',()=>changeQty(item,-item.qty),'remove danger');
   removeButton.setAttribute('aria-label','Remover '+item.name);
   remove.append(removeButton);
   row.append(name,node('td',money(item.cents),'num'),qty,node('td',money(item.cents*item.qty),'num'),remove);
   return row;
 }));
 const count=state.cart.reduce((sum,item)=>sum+item.qty,0);
 $('units').textContent=count+(count===1?' item':' itens');
 $('subtotal').textContent='Subtotal '+money(subtotal())+' · Desconto '+money(state.discount)+(state.appliedCoupon?' ('+state.appliedCoupon.code+')':'');
 $('total').textContent=money(total());
 $('discountBtn').disabled=$('clearBtn').disabled=!count;
 $('checkoutBtn').disabled=!count || !register;
 $('lastReceipt').disabled=!operatorSales().length;
 renderProducts();
}
$('search').oninput=renderProducts;
$('search').onfocus=$('search').onclick=()=>{
 if($('products').hidden && !$('quantityDialog').open) renderProducts();
};
$('search').onkeydown=event=>{
 if(event.key==='Escape'){ $('products').hidden=true; return; }
 if(event.key==='ArrowDown'){
   event.preventDefault();
   if($('products').hidden) renderProducts();
   $('products').querySelector('button')?.focus();
 }
 if(event.key==='Enter' && event.currentTarget.value.trim()){
   event.preventDefault();
   if($('products').hidden) renderProducts();
   const query=norm(event.currentTarget.value);
   const exact=candidates.find(p=>norm(p.sku)===query || norm(p.barcode)===query);
   const product=exact??candidates.find(item=>available(item)>0)??candidates[0];
   if(product) selectProduct(product);
   else status('Nenhum produto disponível para adicionar.',true);
 }
};
$('products').onkeydown=event=>{
 if(event.key==='Escape'){ $('search').focus(); $('products').hidden=true; return; }
 if(!['ArrowDown','ArrowUp'].includes(event.key)) return;
 event.preventDefault();
 const controls=[...$('products').querySelectorAll('button')];
 const next=controls.indexOf(document.activeElement)+(event.key==='ArrowDown'?1:-1);
 if(next<0) $('search').focus();
 else controls[next]?.focus();
};
window.addEventListener('resize',positionProductResults);
window.addEventListener('scroll',positionProductResults,true);
document.addEventListener('pointerdown',event=>{
 if(!event.target.closest('.searchPanel, #products')) $('products').hidden=true;
});
document.addEventListener('keydown',event=>{
 if(document.querySelector('dialog[open]')) return;
 if(event.key==='F2'){ event.preventDefault(); $('search').focus(); $('search').select(); }
 if(event.key==='F4'&&!$('checkoutBtn').disabled){event.preventDefault(); checkout();}
});
$('clearBtn').onclick=()=>{
 if(!confirm('Limpar os itens e o desconto da venda atual?')) return;
 try { setCart([]); status('Venda limpa.'); $('search').focus(); }
 catch(error){ status(error.message,true); }
};
let activeOperatorId='';
let accessConfig=null;
let billingShown='';
const operatorIcon='<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.5 18a7 7 0 0 1 13 0"/></svg>';

function activateOperator(id){
 activeOperatorId=id;
 const current=Object.hasOwn(state.operatorSessions||{},id)?state.operatorSessions[id]:{};
 Object.assign(state,{
   register:current.register??null,cart:current.cart??[],
   discount:current.discount??0,appliedCoupon:current.appliedCoupon??null
 });
 $('search').value='';
 render();
 renderRegister();
}

function selectOperator(operator){
 activateOperator(operator.id);
 if(state.register){ $('search').focus();return; }
 $('openForm').reset();
 $('openForm').elements.operator.value=operator.name;
 show('openDialog');
}

function renderOperators(){
 if(!accessConfig || accessConfig.blocked) return;
 const list=$('operatorButtons');
 const operators=[...accessConfig.operators];
 const previous=state.operatorSessions?.legacy?.register;
 if(previous) operators.unshift({id:'legacy',name:previous.operator});
 list.replaceChildren(...operators.map(operator=>{
   const control=button('',()=>selectOperator(operator),'lc-operator');
   control.innerHTML=operatorIcon;
   control.append(node('span',operator.name));
   control.setAttribute('aria-pressed',String(operator.id===activeOperatorId));
   return control;
 }));
 $('newOperator').hidden=accessConfig.total>=accessConfig.limit;
 $('operatorPanel').hidden=false;
}

function applyAccess(config){
 const changed=accessConfig && (accessConfig.billing!==config.billing || JSON.stringify(accessConfig.monthly)!==JSON.stringify(config.monthly));
 accessConfig=config;
 if(changed && $('monthlyPaymentDialog').open) $('monthlyPaymentDialog').close();
 if($('accountDialog').open)renderAccount();
 $('blockedPay').hidden=!config.monthly?.cents;
 const blocked=$('accessBlocked');
 if(config.blocked){
   window.LC_CLOUD_READY=false;
   if(!blocked.open) blocked.showModal();
   return false;
 }
 if(blocked.open) blocked.close();
 if(config.billing){
   const key='listcaixa_billing_'+config.scope;
   let last=billingShown;
   try{last=localStorage.getItem(key)||last;}catch(_){}
   if(last!==config.day){
     billingShown=config.day;
     try{localStorage.setItem(key,config.day);}catch(_){}
     if(!$('billingNotice').open) $('billingNotice').showModal();
   }
 }
 return true;
}

function loadOperatorView(next){
 state=next;
 const allowed=accessConfig.operators.some(operator=>operator.id===activeOperatorId);
 const legacy=state.operatorSessions?.legacy?.register;
 activateOperator(allowed?activeOperatorId:legacy?'legacy':'');
}

$('accessBlocked').addEventListener('cancel',event=>event.preventDefault());
$('newOperator').onclick=()=>{ $('operatorForm').reset();show('operatorDialog'); };

function openRegister(){
 const operator=accessConfig?.operators.find(operator=>operator.id===activeOperatorId);
 if(operator){selectOperator(operator);return;}
 status('Selecione um operador na lista abaixo para abrir o caixa.',true);
 $('operatorPanel').scrollIntoView({block:'nearest'});
}
$('openBtn').onclick=openRegister;
form('openForm',values=>{
 const operator=accessConfig?.operators.find(operator=>operator.id===activeOperatorId);
 if(!operator || state.register) throw new Error('Selecione um operador com o caixa fechado.');
 update({register:{id:newId(),operatorId:operator.id,operator:operator.name,opened:new Date().toISOString(),float:requireAmount(values.amount),movements:[]}});
 $('openDialog').close(); render(); status('Caixa aberto.'); $('search').focus();
});
const couponCode=value=>value.trim().toUpperCase();
const percentage=rate=>(rate/100).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
function renderCoupons(){
 const coupons=state.coupons??[];
 $('couponList').replaceChildren(...coupons.map(coupon=>{
   const row=node('div',undefined,'row');
   row.append(node('strong',coupon.code),node('span',percentage(coupon.rate)),button('Remover',()=>{
     if(!confirm('Excluir o cupom '+coupon.code+'?')) return;
     const patch={coupons:(state.coupons??[]).filter(c=>c.code!==coupon.code)};
     if(state.appliedCoupon?.code===coupon.code){patch.discount=0;patch.appliedCoupon=null;}
     try{update(patch);renderCoupons();render();status('Cupom removido.');}catch(error){$('couponDialog').querySelector('.error').textContent=error.message;}
   }));
   return row;
 }));
 if(!coupons.length) $('couponList').append(node('p','Nenhum cupom cadastrado.'));
}
$('couponBtn').onclick=()=>{
 $('couponForm').reset(); renderCoupons(); show('couponDialog');
};
form('couponForm',values=>{
 const code=couponCode(values.code);
 const rate=amount(values.percentage);
 const coupons=state.coupons??[];
 if(!/^[A-Z0-9_-]{1,24}$/.test(code)) throw new Error('Use letras, números, hífen ou sublinhado no código.');
 if(!rate || rate>10000) throw new Error('Informe uma porcentagem maior que zero e de até 100%.');
 if(coupons.some(coupon=>coupon.code===code)) throw new Error('Esse cupom já está cadastrado.');
 update({coupons:[...coupons,{code,rate}]});
 $('couponForm').reset(); renderCoupons();
 $('couponDialog').querySelector('.error').textContent='Cupom salvo.';
});
$('discountBtn').onclick=()=>{
 const select=$('availableCoupons');
 select.replaceChildren(new Option('Selecione um cupom...', ''));
 (state.coupons??[]).forEach(c=>select.add(new Option(c.code+' — '+percentage(c.rate)+' de desconto',c.code)));
 select.value=state.appliedCoupon?.code??'';
 $('discountForm').querySelector('button.primary').disabled=!(state.coupons??[]).length;
 $('appliedCoupon').textContent=state.discount||state.appliedCoupon?'Desconto aplicado: '+money(state.discount):'';
 $('removeDiscount').hidden=!state.discount&&!state.appliedCoupon;
 show('discountDialog');
};
form('discountForm',values=>{
 const coupon=(state.coupons??[]).find(item=>item.code===couponCode(values.code));
 if(!coupon) throw new Error('Cupom não encontrado. Cadastre o código em Cadastrar cupom.');
 if(!state.cart.length) throw new Error('Adicione produtos antes de aplicar um cupom.');
 update({discount:couponDiscount(coupon,subtotal()),appliedCoupon:coupon});
 $('discountDialog').close(); render(); status('Cupom '+coupon.code+' aplicado ('+percentage(coupon.rate)+').');
});
$('removeDiscount').onclick=()=>{
 try {
   update({discount:0,appliedCoupon:null});
   $('discountDialog').close(); render(); status('Desconto removido.');
 } catch(error){ $('discountDialog').querySelector('.error').textContent=error.message; }
};
let variantDraft=[];
function drawVariants(){
 $('hasVariants').checked=variantDraft.length>0;
 $('variantArea').hidden=!$('hasVariants').checked;
 $('variantRows').replaceChildren(...variantDraft.map((v,i)=>{
   const row=node('div',undefined,'lc-variant-row');
   const fields=[['Nome / opção','name','text'],['SKU','sku','text'],['Preço (R$)','price','text'],['Estoque','stock','number']];
   for(const [label,key,type] of fields){
     const wrap=node('label',label);const input=document.createElement('input');input.type=type;input.value=v[key]??'';
     input.oninput=()=>{variantDraft[i][key]=input.value;};wrap.append(input);row.append(wrap);
   }
   row.append(button('Remover',()=>{variantDraft.splice(i,1);drawVariants();}));return row;
 }));
}
$('hasVariants').onchange=()=>{if($('hasVariants').checked&&!variantDraft.length)variantDraft.push({name:'',sku:'',price:'',stock:'0'});if(!$('hasVariants').checked)variantDraft=[];drawVariants();};
$('addVariant').onclick=()=>{variantDraft.push({name:'',sku:'',price:'',stock:'0'});drawVariants();};
function resetProduct(){
 variantDraft=[];drawVariants();
 editing=null;
 $('catalogForm').reset();
 $('saveProduct').textContent='Cadastrar produto';
 $('resetProduct').hidden=true;
 $('catalogDialog').querySelector('.error').textContent='';
}
function removeCatalogProduct(product){
 const affected=state.catalog.filter(item=>item.id===product.id || item.parentId===product.id);
 const ids=new Set(affected.map(item=>item.id));
 const error=$('catalogDialog').querySelector('.error');
 error.textContent='';
 if(Object.values(state.operatorSessions||{}).some(session=>session.cart.some(item=>!item.manual && ids.has(item.id)))){
   error.textContent='Retire o produto e suas variantes dos carrinhos abertos antes de remover do estoque.';
   return;
 }
 const variants=affected.length-1;
 const question='Remover “'+product.name+'” do estoque'+(variants?' junto com '+variants+(variants===1?' variante':' variantes'):'')+'? O cadastro será excluído em definitivo.';
 if(!confirm(question)) return;
 try {
   update({catalog:state.catalog.filter(item=>!ids.has(item.id))},[...ids]);
   if(ids.has(editing)) resetProduct();
   renderCatalog();
   render();
   status('Remoção do estoque enviada para confirmação.');
 } catch(err) {
   error.textContent=err.message;
 }
}
function renderCatalog(){
 $('catalogList').replaceChildren(...filterProducts($('catalogSearch').value).map(product=>{
   const row=node('div',undefined,'row');
   const label=node('div',product.name);
   label.append(node('div',product.sku+' · '+money(product.cents)+' · '+product.stock+' em estoque','hint'));
   const actions=node('div',undefined,'lc-catalog-actions');
   actions.append(button('Editar',()=>{
     editing=product.id;
     const fields=$('catalogForm').elements;
     fields.product.value=product.name;
     fields.sku.value=product.sku;
     fields.barcode.value=product.barcode;
     fields.price.value=decimal(product.cents);
     fields.stock.value=product.stock;
     $('saveProduct').textContent='Salvar alterações';
     $('resetProduct').hidden=false;
     variantDraft=state.catalog.filter(v=>v.parentId===product.id).map(v=>({id:v.id,name:v.variantName??v.name.slice(product.name.length).trim(),sku:v.sku,price:decimal(v.cents),stock:String(v.stock)}));
     drawVariants();fields.product.focus();
   }));
   const remove=button('Remover',()=>removeCatalogProduct(product),'danger');
   remove.setAttribute('aria-label','Remover '+product.name+' do estoque');
   actions.append(remove);
   row.append(label,actions);
   return row;
 }));
 if(!$('catalogList').children.length) $('catalogList').append(node('p','Nenhum produto encontrado.'));
}
$('catalogBtn').onclick=()=>{resetProduct(); $('catalogSearch').value=''; renderCatalog(); show('catalogDialog');};
$('catalogSearch').oninput=renderCatalog;
$('resetProduct').onclick=resetProduct;
form('catalogForm',values=>{
 const product={id:editing??newId(),name:values.product.trim(),sku:values.sku.trim(),barcode:values.barcode.trim(),cents:requireAmount(values.price,true),stock:Number(values.stock)};
 const variants=variantDraft.map(v=>({id:v.id??newId(),parentId:product.id,variantName:String(v.name).trim(),name:product.name+' — '+String(v.name).trim(),sku:String(v.sku).trim(),barcode:'',cents:requireAmount(String(v.price),true),stock:Number(v.stock)}));
 if(variants.some(v=>!v.variantName||!v.sku||!Number.isInteger(v.stock)||v.stock<0||v.stock>999999))throw new Error('Preencha nome, SKU, preço e estoque válido de todas as variantes.');
 if(!product.name || !product.sku) throw new Error('Informe o nome e o código interno.');
 if(!Number.isInteger(product.stock) || product.stock<0 || product.stock>999999) throw new Error('Informe um estoque inteiro válido.');
 const codes=[norm(product.sku),product.barcode].filter(Boolean);
 const duplicate=state.catalog.some(other=>other.id!==editing && codes.some(code=>code===norm(other.sku)||code===other.barcode));
 if(duplicate) throw new Error('Esse código já pertence a outro produto.');
 const allCodes=[norm(product.sku),...variants.map(v=>norm(v.sku))];
 if(new Set(allCodes).size!==allCodes.length)throw new Error('Os SKUs das variantes devem ser diferentes entre si e do produto principal.');
 if(variants.some(v=>state.catalog.some(other=>other.id!==v.id&&other.id!==product.id&&norm(other.sku)===norm(v.sku))))throw new Error('SKU de variante já cadastrado em outro produto.');
 if(variants.some(v=>v.stock<(state.cart.find(item=>item.id===v.id)?.qty??0)))throw new Error('Estoque de variante menor que a quantidade na venda atual.');
 if(product.stock<(state.cart.find(item=>item.id===editing)?.qty??0)) throw new Error('O estoque informado é menor que a quantidade na venda atual.');
 const prior=state.catalog.filter(other=>other.parentId===product.id);
 if(prior.some(v=>!variants.some(n=>n.id===v.id)&&state.cart.some(item=>item.id===v.id)))throw new Error('Retire da venda as variantes que deseja excluir.');
 const remaining=state.catalog.filter(other=>other.id!==product.id&&other.parentId!==product.id);
 update({catalog:[...remaining,product,...variants]});
 resetProduct(); renderCatalog(); render(); status('Produto salvo.');
});
function normalizePixKey(input){
 const value=input.trim();
 if(/^[!-~]+@[!-~]+\.[A-Za-z]{2,}$/.test(value) && value.length<=77) return value.toLowerCase();
 if(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) return value.toLowerCase();
 const digits=value.replace(/[^0-9]/g,'');
 if(value.startsWith('+') && /^\+[0-9 ()-]+$/.test(value) && digits.length>=8 && digits.length<=15) return '+'+digits;
 if(/^[0-9. /-]+$/.test(value) && (digits.length===11||digits.length===14)) return digits;
 throw new Error('Informe um CPF/CNPJ, e-mail, chave aleatória ou telefone com + e código do país.');
}
const pixText=(value,limit)=>norm(value).toUpperCase().replace(/[^A-Z0-9 .&/-]/g,'').replace(/\s+/g,' ').trim().slice(0,limit);
$('pixBtn').onclick=()=>{
 const fields=$('pixForm').elements;
 for(const name of ['pixKey','receiver','bank','city']) fields.namedItem(name).value=state.pix?.[name]??'';
 show('pixDialog');
};
form('pixForm',values=>{
 const pix={pixKey:normalizePixKey(values.pixKey),receiver:values.receiver.trim(),bank:values.bank.trim(),city:values.city.trim()};
 if(!pixText(pix.receiver,25)||!pix.bank||!pixText(pix.city,15)) throw new Error('Preencha recebedor, banco e cidade.');
 update({pix}); $('pixDialog').close(); status('Chave Pix salva.');
});
const brField=(id,value)=>id+String(value.length).padStart(2,'0')+value;
function pixPayload(pix,cents,reference,description){
 reference=reference||state.register.id.replace(/[^A-Za-z0-9]/g,'').slice(-12)+state.nextNumber;
 let account=brField('00','br.gov.bcb.pix')+brField('01',pix.pixKey);
 const capacity=99-account.length-4;
 const info=description && capacity>0 ? pixText(description,capacity) : '';
 if(info)account+=brField('02',info);
 const fields=[
   ['00','01'],['26',account],
   ['52','0000'],['53','986'],['54',(cents/100).toFixed(2)],['58','BR'],
   ['59',pixText(pix.receiver,25)],['60',pixText(pix.city,15)],['62',brField('05',reference.slice(-25))]
 ];
 const payload=fields.map(([id,value])=>brField(id,value)).join('')+'6304';
 let crc=0xffff;
 for(const char of payload){
   crc^=char.charCodeAt(0)<<8;
   for(let bit=0;bit<8;bit++) crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;
 }
 return payload+crc.toString(16).toUpperCase().padStart(4,'0');
}
function drawPix(canvas,payload){
 const qr=new PixQRCode(-1,1);
 qr.addData(payload);
 qr.make();
 const count=qr.getModuleCount();
 const scale=6, margin=4;
 canvas.width=canvas.height=(count+margin*2)*scale;
 const context=canvas.getContext('2d');
 context.fillStyle='#fff';
 context.fillRect(0,0,canvas.width,canvas.height);
 context.fillStyle='#000';
 for(let row=0;row<count;row++){
   for(let column=0;column<count;column++){
     if(qr.isDark(row,column)) context.fillRect((column+margin)*scale,(row+margin)*scale,scale,scale);
   }
 }
}
function monthlyDate(value){
 const parts=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');
 return parts?parts[3]+'/'+parts[2]+'/'+parts[1]:'A definir';
}

function renderAccount(){
 const profile=state.store||{};
 $('accountCompany').textContent=profile.storeName||'Empresa sem nome cadastrado';
 $('accountCompanyDetails').textContent=[profile.taxId,profile.phone,profile.address].filter(Boolean).join(' · ');
 const monthly=accessConfig?.monthly||{};
 $('accountAmount').textContent=monthly.cents?money(monthly.cents):'A definir';
 $('accountDue').textContent=monthlyDate(monthly.due)+(monthly.dueDay?' · Todo dia '+monthly.dueDay:'');
 $('accountDescription').textContent=monthly.description||'Mensalidade ListCaixa';
 $('accountBillingStatus').textContent=accessConfig?.billing?'Cobrança pendente':'Em dia';
 $('accountPay').disabled=!accessConfig;
 const link=$('accountCloseLink');
 const number=monthly.whatsapp;
 link.hidden=!number;
 $('accountCloseHelp').hidden=Boolean(number);
 if(number){
   const message='Olá! Gostaria de solicitar o encerramento da minha conta ListCaixa'+(profile.storeName?' da empresa '+profile.storeName:'')+'.';
   link.href='https://wa.me/'+number+'?text='+encodeURIComponent(message);
 }else link.removeAttribute('href');
}

function prepareMonthlyConfirmation(monthly){
 const link=$('monthlyConfirm'), help=$('monthlyConfirmHelp');
 link.hidden=true;
 link.removeAttribute('href');
 help.hidden=false;
 if(!monthly.whatsapp){
   help.textContent='O WhatsApp do suporte ainda não está configurado.';
   return;
 }
 const company=state.store?.storeName?.trim()||'';
 const period=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})
   .format(new Date(monthly.due+'T00:00:00Z'));
 const message=[
   'Olá! Já realizei o pagamento da mensalidade do ListCaixa.',
   '',
   'Empresa: '+(company||'[informe o nome da empresa cadastrada]'),
   'Mensalidade referente a: '+period,
   'Valor pago: '+money(monthly.cents),
   'Vencimento: '+monthlyDate(monthly.due),
   '',
   'Por favor, confirmem o recebimento. Posso anexar o comprovante nesta conversa.'
 ].join('\n');
 link.href='https://wa.me/'+monthly.whatsapp+'?text='+encodeURIComponent(message);
 link.hidden=false;
 help.hidden=Boolean(company);
 if(!company)help.textContent='Preencha o nome da empresa na mensagem antes de enviar.';
}

function openMonthlyPayment(){
 const config=accessConfig;
 if(!config) return;
 const monthly=config.monthly||{};
 const {cents,receiver,city,bank,due,description}=monthly;
 $('monthlyPaymentAmount').textContent=cents?money(cents):'A definir';
 $('monthlyPaymentDue').textContent=monthlyDate(due);
 $('monthlyPaymentDescription').textContent=description||'Mensalidade ListCaixa';
 $('monthlyPayee').textContent=[receiver,bank,city].filter(Boolean).join(' · ');
 $('monthlyPayCode').value='';
 $('monthlyPayError').textContent='';
 $('monthlyPayQR').hidden=true;
 $('monthlyPayTools').hidden=true;
 try {
   if(!cents || !due || !bank || !pixText(receiver,25) || !pixText(city,15)){
     throw new Error('O pagamento ainda não está disponível. Fale com o suporte para confirmar os dados da mensalidade.');
   }
   const pixKey=normalizePixKey(monthly.pixKey||'');
   const reference='MENSALIDADE'+due.replace(/-/g,'');
   const payload=pixPayload({pixKey,receiver,city},cents,reference,description);
   $('monthlyPayCode').value=payload;
   prepareMonthlyConfirmation(monthly);
   $('monthlyPayTools').hidden=false;
   try{
     drawPix($('monthlyPayQR'),payload);
     $('monthlyPayQR').hidden=false;
   }catch(_){$('monthlyPayError').textContent='Use o código Pix Copia e Cola.';}
 }catch(_){
   $('monthlyPayError').textContent='O pagamento ainda não está disponível. Fale com o suporte para confirmar os dados da mensalidade.';
 }
 $('monthlyPaymentDialog').showModal();
}

$('accountSettings').onclick=()=>{renderAccount();show('accountDialog');};
$('accountCompanyEdit').onclick=()=>{$('accountDialog').close();$('storeBtn').click();};
$('accountStorePix').onclick=()=>{$('accountDialog').close();$('pixBtn').click();};
$('accountPay').onclick=openMonthlyPayment;
$('billingPay').onclick=openMonthlyPayment;
$('blockedPay').onclick=openMonthlyPayment;
$('monthlyCopy').onclick=async()=>{
 const field=$('monthlyPayCode');
 try{await navigator.clipboard.writeText(field.value);$('monthlyPayError').textContent='Código Pix copiado.';}
 catch(_){field.focus();field.select();$('monthlyPayError').textContent='Código selecionado. Use a opção Copiar do dispositivo.';}
};
function renderPix(method){
 const active=method==='Pix'&&total()>0;
 $('pixOnly').hidden=!active;
 $('pixQR').hidden=true;
 $('pixCopyArea').hidden=true;
 $('pixCopy').value='';
 $('pixDetails').textContent='';
 $('pixMessage').textContent='';
 if(!active) return;
 const pix=state.pix;
 if(!pix){
   $('pixDetails').textContent='Para gerar um QR Code, cadastre a chave em Configurar Pix.';
   $('pixMessage').textContent='Se recebeu por outra chave, você pode registrar a venda após conferir o pagamento.';
   return;
 }
 $('pixDetails').textContent=pix.receiver+' · '+pix.bank+' · '+money(total());
 const payload=pixPayload(pix,total());
 $('pixCopy').value=payload;
 $('pixCopyArea').hidden=false;
 try {
   drawPix($('pixQR'),payload);
   $('pixQR').hidden=false;
 } catch { $('pixMessage').textContent='Use o código Pix Copia e Cola para este pagamento.'; }
}
$('copyPix').onclick=async ()=>{
 const field=$('pixCopy');
 try {
   await navigator.clipboard.writeText(field.value);
   $('pixMessage').textContent='Código Pix copiado.';
 } catch {
   field.focus(); field.select();
   $('pixMessage').textContent='Código selecionado. Use Ctrl+C ou a opção Copiar.';
 }
};
function creditParts(){return Math.max(1,Math.min(24,Number(document.getElementById('creditParts').value)||1));}
function creditAmounts(cents,parts){const base=Math.floor(cents/parts),rest=cents%parts;return Array.from({length:parts},(_,i)=>base+(i<rest?1:0));}
function updateCredit(){
 const selected=$('checkoutForm').elements.method.value==='Cartão de crédito';
 document.getElementById('creditInstallments').hidden=!selected;
 const n=creditParts(),amounts=creditAmounts(total(),n);
 document.getElementById('creditPreview').textContent=n+'x de '+money(amounts[0]);
 document.getElementById('creditDetail').textContent=amounts.every(v=>v===amounts[0])?'Total: '+money(total()):'Parcelas ajustadas em centavos: '+amounts.map(money).join(' + ')+' · Total: '+money(total());
}
const creditSelect=document.getElementById('creditParts');
for(let i=1;i<=24;i++){const opt=document.createElement('option');opt.value=String(i);opt.textContent=i+'x sem juros';creditSelect.append(opt);}
creditSelect.addEventListener('change',updateCredit);
function updateCash(){
 const fields=$('checkoutForm').elements;
 const cash=fields.method.value==='Dinheiro';
 $('cashOnly').hidden=!cash;document.getElementById('fiadoFields').hidden=fields.method.value!=='Fiado';
 fields.received.required=cash;
 const received=amount(fields.received.value);
 $('change').textContent=received===null?'':received<total()?'Faltam '+money(total()-received):'Troco: '+money(received-total());
}
const waitForFeedback=delay=>new Promise(resolve=>setTimeout(resolve,delay));
let paymentAttempt=0;
let savingSale=false;
function confirmFinish(sale){
 const dialog=$('finishDialog');
 $('finishSummary').textContent=money(sale.amount)+' · '+sale.method;
 if(sale.method==='Dinheiro') $('finishSummary').textContent+=' · Troco '+money(sale.received-sale.amount);
 if(sale.method==='Cartão de crédito'&&sale.installments) $('finishSummary').textContent+=' · '+sale.installments+'x sem juros';
 dialog.returnValue='back';
 return new Promise(resolve=>{
   dialog.addEventListener('close',()=>resolve(dialog.returnValue==='finish'),{once:true});
   dialog.showModal();
 });
}
function confirmReady(ready){
 $('confirmSale').hidden=!ready;
 $('confirmSale').disabled=!ready||savingSale;
}
async function choosePayment(method){
 const attempt=++paymentAttempt;
 $('checkoutForm').elements.method.value=method;
 $('checkoutDialog').querySelector('.error').textContent='';
 $('methodChoices').querySelectorAll('button').forEach(control=>{
   control.setAttribute('aria-pressed',String(control.dataset.method===method));
 });
 updateCash();
 updateCredit();
 renderPix('');
 $('paymentHint').hidden=!method||method==='Sem cobrança';
 $('pixLoading').hidden=true;
 const generating=method==='Pix'&&Boolean(state.pix);
 confirmReady(Boolean(method)&&!generating);
 if(generating){
   $('pixLoading').hidden=false;
   await waitForFeedback(260);
   if(attempt!==paymentAttempt||!$('checkoutDialog').open) return;
   $('pixLoading').hidden=true;
   confirmReady(true);
 }
 renderPix(method);
 if(method==='Dinheiro') $('checkoutForm').elements.received.focus();
}
function checkout(){
 if(savingSale) return;
 $('checkoutForm').reset();document.getElementById('fiadoCustomer').value='';document.getElementById('fiadoDue').value='';
 creditSelect.value='1';
 $('paymentTotal').textContent=money(total());
 const free=total()===0;
 $('paymentChoice').hidden=free;
 $('saleLoading').hidden=true;
 show('checkoutDialog');
 choosePayment(free?'Sem cobrança':'');
}
$('checkoutBtn').onclick=checkout;
$('checkoutDialog').addEventListener('close',()=>{paymentAttempt++;});
$('methodChoices').querySelectorAll('button').forEach(control=>{
 control.onclick=()=>{if(!savingSale) choosePayment(control.dataset.method);};
});
$('checkoutForm').elements.received.oninput=updateCash;
$('checkoutForm').onsubmit=async event=>{
 event.preventDefault();
 if(savingSale||$('confirmSale').disabled) return;
 const error=$('checkoutDialog').querySelector('.error');
 error.textContent='';
 try {
   requireRegister();
   if(!state.cart.length) throw new Error('Adicione itens à venda.');
   const due=total();
   const fields=$('checkoutForm').elements;
   const method=due===0?'Sem cobrança':fields.method.value;
   if(!method) throw new Error('Escolha uma forma de pagamento.');
   const received=method==='Dinheiro'?requireAmount(fields.received.value):due;
   if(received<due) throw new Error('O valor recebido é menor que o total.');
   const quantities=new Map(state.cart.map(item=>[item.id,item.qty]));
   if(state.cart.some(item=>!item.manual&&(state.catalog.find(p=>p.id===item.id)?.stock??0)<item.qty)) throw new Error('Estoque insuficiente. Revise a venda.');
   if(method==='Fiado'&&!document.getElementById('fiadoCustomer').value.trim()) throw new Error('Informe o nome do cliente para o fiado.');
   const installments=method==='Cartão de crédito'?creditParts():null;
   const installmentAmounts=installments?creditAmounts(due,installments):null;
   const sale={number:state.nextNumber,date:new Date().toISOString(),registerId:state.register.id,operatorId:state.register.operatorId||activeOperatorId,operator:state.register.operator,method,installments,installmentAmounts,amount:due,received,discount:state.discount,coupon:state.appliedCoupon??null,items:state.cart,fiadoCustomer:method==='Fiado'?document.getElementById('fiadoCustomer').value.trim():null,fiadoDue:method==='Fiado'?document.getElementById('fiadoDue').value:null};
   savingSale=true;
   const attempt=paymentAttempt;
   $('confirmSale').disabled=true;
   if(!await confirmFinish(sale)||attempt!==paymentAttempt||!$('checkoutDialog').open) return;
   $('saleLoading').hidden=false;
   await waitForFeedback(180);
   if(attempt!==paymentAttempt||!$('checkoutDialog').open) return;
   update({catalog:state.catalog.map(p=>({...p,stock:p.stock-(quantities.get(p.id)??0)})),sales:[sale,...state.sales],fiados:method==='Fiado'?[...(state.fiados??[]),{id:newId(),saleNumber:sale.number,customer:sale.fiadoCustomer,due:sale.fiadoDue,amount:due,payments:[],date:sale.date}]:state.fiados??[],nextNumber:state.nextNumber+1,cart:[],discount:0,appliedCoupon:null});
   $('checkoutDialog').close();
   render(); status('Venda registrada. Estoque atualizado.');
   receipt(sale,true);
 } catch(problem){error.textContent=problem.message;}
 finally {
   savingSale=false;
   $('saleLoading').hidden=true;
   $('confirmSale').disabled=false;
 }
};
function receiptContent(target,sale,profile){
 function section(text,className){ target.append(node('p',text,className)); }
 function pair(label,value){
   const line=node('div',undefined,'receiptLine');
   line.append(node('span',label),node('span',value));
   target.append(line);
 }
 const logo=node('img',undefined,'receiptWordmark');
 logo.src=document.querySelector('header .brand img').src;
 logo.alt='ListCaixa';
 logo.width=470;
 logo.height=90;
 target.replaceChildren(logo);
 section('COMPROVANTE DE VENDA','center receiptTitle');
 section(profile.storeName,'center');
 if(profile.taxId) section('CPF/CNPJ: '+profile.taxId,'center');
 if(profile.address) section(profile.address,'center');
 if(profile.phone) section(profile.phone,'center');
 section('Sem valor fiscal','center');
 target.append(node('hr'));
 section('Venda nº '+sale.number+' · '+dateTime(sale.date));
 if(sale.cancellation){
   section('VENDA CANCELADA · '+dateTime(sale.cancellation.date));
   section('Motivo: '+sale.cancellation.reason);
 }
 if(sale.operator) section('Operador: '+sale.operator);
 target.append(node('hr'));
 sale.items.forEach(item=>{
   section(item.name);
   pair(item.qty+' × '+money(item.cents),money(item.qty*item.cents));
 });
 target.append(node('hr'));
 pair('Subtotal',money(subtotal(sale.items)));
 if(sale.discount) pair('Desconto',money(sale.discount));
 if(sale.coupon) section('Cupom: '+sale.coupon.code+' ('+percentage(sale.coupon.rate)+')');
 pair('TOTAL',money(sale.amount));
 section('Pagamento: '+sale.method);
 if(sale.method==='Cartão de crédito'&&sale.installments){section('Parcelamento: '+sale.installments+'x sem juros');(sale.installmentAmounts||creditAmounts(sale.amount,sale.installments)).forEach((v,i)=>pair('Parcela '+(i+1)+'/'+sale.installments,money(v)));}
 if(sale.method==='Dinheiro'){
   pair('Recebido',money(sale.received));
   pair('Troco',money(sale.received-sale.amount));
 }
 if(profile.note){ target.append(node('hr')); section(profile.note,'center'); }
}
function receipt(sale,forNewSale=false){
 currentReceipt=sale;
 justFinishedReceipt=forNewSale;
 $('nextSale').hidden=!forNewSale;
 const profile=store();
 receiptContent($('receipt'),sale,profile);
 receiptContent($('printArea'),sale,profile);
 $('printArea').style.setProperty('--paper-content',profile.paper==='58'?'50mm':'72mm');
 $('receipt').style.maxWidth=profile.paper==='58'?'58mm':'80mm';
 show('receiptDialog');
}
let returnToReceipt=false;
function customize(fromReceipt){
 returnToReceipt=fromReceipt;
 if(fromReceipt) $('receiptDialog').close();
 const fields=$('storeForm').elements;
 for(const [name,value] of Object.entries(store())) fields.namedItem(name).value=value;
 show('storeDialog');
}
$('storeBtn').onclick=()=>customize(false);
$('customizeReceipt').onclick=()=>customize(true);
$('storeDialog').addEventListener('close',()=>{
 if(returnToReceipt && currentReceipt) receipt(currentReceipt,justFinishedReceipt);
 returnToReceipt=false;
});
form('storeForm',values=>{
 const profile={};
 for(const name of Object.keys(defaultStore)) profile[name]=values[name].trim();
 if(!profile.storeName) throw new Error('Informe o nome da loja.');
 update({store:profile});
 $('storeDialog').close();
 status('Personalização do comprovante salva.');
});
$('printBtn').onclick=async()=>{
 if(!currentReceipt) return;
 const control=$('printBtn'), area=$('printArea');
 control.disabled=true;
 try {
   const logo=area.querySelector('.receiptWordmark');
   if(logo && typeof logo.decode==='function') await logo.decode().catch(()=>{});
   const paper=store().paper==='58'?58:80;
   area.classList.add('lc-measure-receipt');
   // CSS usa 96 px por polegada. Some 8 mm de margens e 2 mm de folga.
   const height=Math.ceil(area.getBoundingClientRect().height*25.4/96)+10;
   $('lcReceiptPaper').textContent='@page { size: '+paper+'mm '+height+'mm; margin: 4mm; }';
   area.classList.remove('lc-measure-receipt');
   window.print();
 } finally {
   area.classList.remove('lc-measure-receipt');
   control.disabled=false;
 }
};
$('nextSale').onclick=()=>{
 $('receiptDialog').close();
 $('search').value='';
 renderProducts();
 $('search').focus();
};
function operatorSales(){
 if(!activeOperatorId) return state.sales;
 const name=state.register?.operator||accessConfig?.operators.find(item=>item.id===activeOperatorId)?.name;
 return state.sales.filter(sale=>sale.operatorId && sale.operatorId!=='legacy' ? sale.operatorId===activeOperatorId : sale.operator===name);
}
$('lastReceipt').onclick=()=>{const [last]=operatorSales();if(last)receipt(last);};
function lookup(){
 const query=$('lookupSearch').value.trim();
 const rows=query?filterProducts(query):[];
 $('lookupResults').replaceChildren(...rows.map(product=>{
   const row=node('div',undefined,'row');
   const label=node('strong',product.name);
   label.append(node('div',product.sku+' · '+product.stock+' em estoque','hint'));
   row.append(label,node('strong',money(product.cents)));
   return row;
 }));
 if(query&&!rows.length) $('lookupResults').append(node('p','Nenhum produto encontrado.'));
}
$('lookupSearch').oninput=lookup;
$('priceLookup').onclick=()=>{$('lookupSearch').value='';lookup();show('lookupDialog');$('lookupSearch').focus();};
const dayKey=date=>date.toLocaleDateString('sv-SE');
function reportSales(date){
 return state.sales.filter(sale=>dayKey(new Date(sale.date))===date).sort((a,b)=>a.date.localeCompare(b.date));
}
function dailyCancellations(date){
 return state.sales.filter(sale=>sale.cancellation&&dayKey(new Date(sale.cancellation.date))===date);
}
function reportTotals(sales,cancellations){
 const methods=new Map();
 let gross=0, refunds=0, discounts=0, units=0;
 function method(name){
   if(!methods.has(name)) methods.set(name,{name,count:0,gross:0,refunds:0});
   return methods.get(name);
 }
 for(const sale of sales){
   const group=method(sale.method);
   group.count++;
   group.gross+=sale.amount;
   gross+=sale.amount;
   discounts+=sale.discount??0;
   units+=sale.items.reduce((count,item)=>count+item.qty,0);
 }
 for(const sale of cancellations){
   method(sale.method).refunds+=sale.amount;
   refunds+=sale.amount;
 }
 return {gross,refunds,net:gross-refunds,discounts,units,methods:[...methods.values()]};
}
function pdfText(text){
 return Array.from(String(text),character=>{
   const code=character.charCodeAt(0);
   if(code>255) return '?';
   if(code<32||code>126||'()\\'.includes(character)) return '\\'+code.toString(8).padStart(3,'0');
   return character;
 }).join('');
}
const LC_LOGO_WIDTH=950,LC_LOGO_HEIGHT=317;
const LC_PDF_LOGO='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAcFBQYFBAcGBgYIBwcICxILCwoKCxYPEA0SGhYbGhkWGRgcICgiHB4mHhgZIzAkJiorLS4tGyIyNTEsNSgsLSz/2wBDAQcICAsJCxULCxUsHRkdLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCz/wAARCAE9A7YDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD6QooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACjrRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAHaiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAozRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAHaiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooo7UAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAZwMngCovtVv/wA94v8AvsVn+JyR4T1cg4xZTf8AoBr4YEjbVy7Hj1ranS9pfU0hDmPvf7Vb/wDPeL/vsUfarf8A57xf99ivgjzG9T+dHmN/eP51r9W8y/ZeZ97/AGm3/wCe8X/fYp6SxyZ2SK2Ou05r4GEjd2P5179+zIxZfEXJPNv1/wCB1M6HLG9yZU7K9z32iiiuYyCiiigAooooAQnAzXH/APCfrkj+zzwcf63/AOtXYMOD9K8hggW51GOBpxGJJQhY9snrXqZfQp1VJ1Fe1v1OmhCMr8x1v/Cfgf8AMNP/AH9/+tR/wsFf+gaf+/v/ANar6+B9JCjd9oY+vmdf0pT4I0g/wzj/ALaVfPgP5X+P+Y70exnf8LBX/oHN/wB/f/rVo6F4sXWtQa1FoYSEL7t+7oR7e9Z+t+EdMsNInuopZY3iXcN75De1ZvgVlPiJ9q/8sG5/EVrKjhalCVSlHb1G405Qcoo9Eoo7UV4ZyBRR3ooAKKKKACiiigAooooAKKKKACikJwCa8W+Inxx1XwZ42utDtNIs7qKBI2EkrsGO5A3b61UYObshpN6I9qor5u/4aa13/oX9O/7+vSf8NNa7/wBADTv+/j1r7CZfs5H0lRXzd/w01rv/AEL+nf8Af166DwJ8d9Y8WeN9O0S50ext4bx2VpI5HLLhS3GeO1J0ZpXE6cke40UgPFLWJAUUUUAFFFFABRRSM6IrM7BVUZJJwAKAForynxp8fPD/AIeMlroyjW75eCY22wIfd/4v+A5+teI+I/jD408Sl0m1VrK2b/lhZfulx6Ej5j+JraNG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KOh+h6H2NdVRTTad0NOx8Falp11pGp3Gn30LQXVtIY5Y26qwqtX2V4p+E3hPxhrA1TVbOU3ewRs8MzR7wOmcdT2zWMf2fvAf/Ppej/t7eu1YiNtTf2q6ngXwx8eXHgLxUl2WZ9NucRXkI7p2YD+8vUfiO9fYlpdwX9nDdW0qTQTIJI5EOVZSMgivN/8AhnzwEf8Al1vv/At67fwz4ZsPCeix6Vphn+yRMTGs0pkKZ5IBPbPb3rCrOM9UZzalqjRvLO2v7OW0u4I7i3mUpJHIoZWB7EV87fEX4AXljJLqPg9GvLUks1gzfvY/9wn7w9jz9a+j6KzhNwehMZOOx8CT209rcPBcwyQTRnDxyKVZT6EHkUyvuDxJ4I8O+LodmtaVb3TAYWXG2Rfo4wR+deYar+zNok7s+k63e2Wekc6LMo/H5T+prrjiIvc2VRPc+bqK9suP2ZddVj9m1/TpF7eZG6H9M0yH9mbxEzfvtd0yNfVEkY/yFae1h3K549zxanwxyTzpDFG8srnaqIpZmPoAOtfRWkfsy6XC6vq+vXV0B1jtohCD+J3GvT/DPgHwz4QT/iTaVDBLjBnb55W/4Gcn8BxWcsRFbEuolseL/DX4CT3MkWreL4TFbjDR6cT88np5noP9nr64qb9peGKEeGIooljjjSdUVRgKB5eAAOgr6EwO3Fct4x+HegeO2tDrcU8hs9wi8qYx43YznHX7orBVW5qUjNT967Piuuq+GBx8VPDf/X8lfQo/Z98Bjpa3v/gW9XdH+CXgzQtbtNVsra7W6s5BLEWuWYBh0yO9byrxasaOorHfr92nUgAA4pa4TnCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACij8KKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKBRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAB3ooooAKKKKACiiigAooooAKKKKACjNFFABQKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooo7UAFFJmloAKKKM0AFFGaM0AFFFGaACikzS0AFFHakzQAtFFFABRRSZoAWiiigAooo7UAFFJmloAKKKKACiiigAooooAKKKKACiiigAoopKAFooooAKKKKACijtRQAUUUlAC0UUZoAKKKKACiiigAoo70ZoAKKM0UAFFFFABRRR2oAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACijNFABRRRQAUUUUAFFFFABRSd6WgAooooAKKKM0AFFFFABRRRQAUUmaXNABRRRQAUUUUAFFFGaACijNFABRRRQAUUUUAFFFFABRRmigAooooAKKKKACiiigAooooAKKKM0AFFANFAH//2Q==';
function makeReportPdf(date,sales){
 const cancellations=dailyCancellations(date).sort((a,b)=>a.cancellation.date.localeCompare(b.cancellation.date));
 const totals=reportTotals(sales,cancellations);
 const dated=date.split('-').reverse().join('/');
 const left=36, width=523, right=left+width;
 const palette={navy:'0.17 0.07 0.24',blue:'0.39 0.17 0.52',ink:'0.16 0.11 0.21',muted:'0.45 0.41 0.49',line:'0.88 0.85 0.92',soft:'0.97 0.95 0.99',white:'1 1 1',green:'0.05 0.51 0.26',red:'0.70 0.16 0.22'};
 const pages=[];
 let commands=[], y=721;
 function measure(value,size,bold=false){
   return Array.from(String(value)).reduce((sum,char)=>{
     if(/[ ilI.,:!|']/u.test(char)) return sum+.29;
     if(/[MW@%]/u.test(char)) return sum+.91;
     if(/[A-ZÀ-ÖØ-Þ]/u.test(char)) return sum+.73;
     return sum+(bold?.59:.56);
   },0)*size;
 }
 function text(value,x,baseline,{size=10,bold=false,color='ink',align='left',max=Infinity}={}){
   const fit=Math.min(size,max/Math.max(1,measure(value,size,bold))*size);
   if(align==='right') x-=measure(value,fit,bold);
   commands.push('BT /F'+(bold?2:1)+' '+fit.toFixed(2)+' Tf '+palette[color]+' rg 1 0 0 1 '+x.toFixed(2)+' '+baseline+' Tm ('+pdfText(value)+') Tj ET');
 }
 function box(x,bottom,w,h,color){
   commands.push(palette[color]+' rg '+x+' '+bottom+' '+w+' '+h+' re f');
 }
 function wrap(value,max,size){
   const output=[];
   let current='';
   for(const word of String(value).split(/\s+/)){
     if(current&&measure(current+' '+word,size)>max){output.push(current);current='';}
     if(measure(word,size)>max){
       let piece='';
       for(const char of word){
         if(piece&&measure(piece+char,size)>max){output.push(piece);piece='';}
         piece+=char;
       }
       current=piece;
     } else current=current?current+' '+word:word;
   }
   return [...output,current];
 }
 function paragraph(value,x,max,{size=10,color='muted',bold=false}={}){
   for(const line of wrap(value,max,size)){
     ensure(size+5);
     text(line,x,y-10,{size,color,bold});
     y-=size+5;
   }
 }
 function startPage(){
   box(0,744,595,98,'white');
   box(0,741,595,3,'blue');
   commands.push('q 150 0 0 54 36 772 cm /Logo Do Q');
   text('RELATÓRIO DIÁRIO DE VENDAS',210,806,{size:15,bold:true,color:'navy',max:340});
   text(store().storeName,210,785,{size:10,color:'muted',max:340});
   text(dated,right,760,{size:11,bold:true,color:'blue',align:'right'});
 }
 function page(){
   box(left,37,width,1,'line');
   text('Fechamento de vendas · '+dated,left,22,{size:9,color:'muted'});
   text('Página '+(pages.length+1),right,22,{size:9,color:'muted',align:'right'});
   pages.push(commands.join('\n')+'\n');
   commands=[]; y=721;
 }
 function ensure(height){
   if(y-height<51){page();startPage();}
 }
 function section(title,height=30){
   ensure(height);
   text(title,left,y-14,{size:14,bold:true,color:'navy'});
   y-=26;
 }
 function metric(label,value,index,color){
   const gap=8, card=(width-gap*3)/4, x=left+index*(card+gap);
   box(x,y-58,card,58,'soft');
   box(x,y-3,card,3,'blue');
   text(label,x+9,y-20,{size:9,bold:true,color:'muted',max:card-18});
   text(value,x+9,y-42,{size:16,bold:true,color,max:card-18});
 }
 function paymentHeader(){
   box(left,y-20,width,20,'blue');
   text('Forma de pagamento',left+8,y-14,{size:9,bold:true,color:'white'});
   for(const [label,x] of [['Vendas',left+229],['Registrado',left+322],['Cancelado',left+416],['Líquido',right-8]]){
     text(label,x,y-14,{size:9,bold:true,color:'white',align:'right'});
   }
   y-=20;
 }
 function saleHeader(sale,continued=false){
   box(left,y-24,width,24,'blue');
   text('Venda nº '+sale.number+(continued?' (continuação)':''),left+8,y-16,{size:11,bold:true,color:'white',max:210});
   text(dateTime(sale.date)+'  |  '+sale.method,right-8,y-16,{size:9,color:'white',align:'right',max:290});
   y-=24;
 }
 function itemHeader(){
   box(left,y-19,width,19,'soft');
   text('Produto',left+8,y-13,{size:9,bold:true});
   text('Qtd.',left+327,y-13,{size:9,bold:true,align:'right'});
   text('Preço un.',left+419,y-13,{size:9,bold:true,align:'right'});
   text('Total do item',right-8,y-13,{size:9,bold:true,align:'right'});
   y-=19;
 }
 function continueSale(sale,height,withItems=false){
   if(y-height>=51) return;
   page();startPage();saleHeader(sale,true);
   if(withItems) itemHeader();
 }
 startPage();
 metric('Total registrado',money(totals.gross),0,'navy');
 metric('Cancelamentos',money(totals.refunds),1,'red');
 metric('Líquido do dia',money(totals.net),2,totals.net<0?'red':'green');
 metric('Vendas registradas',String(sales.length),3,'navy');
 y-=72;
 text('Descontos concedidos: '+money(totals.discounts)+'   |   Itens nas vendas registradas: '+totals.units+'   |   Vendas canceladas no dia: '+cancellations.length,left,y-7,{size:10,color:'muted',max:width});
 y-=23;
 section('Resumo por pagamento',67);
 paymentHeader();
 if(!totals.methods.length){
   paragraph('Nenhum movimento de venda nessa data.',left+8,width-16);
 }
 for(const [index,group] of totals.methods.entries()){
   if(y<77){page();startPage();section('Resumo por pagamento (continuação)');paymentHeader();}
   box(left,y-20,width,20,index%2?'soft':'white');
   text(group.name,left+8,y-14,{size:9,max:145});
   text(group.count,left+229,y-14,{size:9,align:'right',max:64});
   text(money(group.gross),left+322,y-14,{size:9,align:'right',max:84});
   text(money(group.refunds),left+416,y-14,{size:9,align:'right',max:84});
   text(money(group.gross-group.refunds),right-8,y-14,{size:9,bold:true,align:'right',max:90});
   y-=20;
 }
 y-=12;
 section('Vendas detalhadas',105);
 if(!sales.length) paragraph('Nenhuma venda registrada nessa data.',left,width);
 for(const sale of sales){
   ensure(92);
   saleHeader(sale);
   if(sale.operator) paragraph('Operador: '+sale.operator,left+8,width-16,{size:9});
   if(sale.cancellation) paragraph('Venda cancelada em '+dateTime(sale.cancellation.date),left+8,width-16,{size:9,color:'red',bold:true});
   ensure(36);
   itemHeader();
   for(const [index,item] of sale.items.entries()){
     const name=wrap(item.name,280,9);
     const height=Math.max(19,name.length*12+6);
     continueSale(sale,height,true);
     box(left,y-height,width,height,index%2?'soft':'white');
     name.forEach((line,i)=>text(line,left+8,y-13-i*12,{size:9}));
     text(item.qty,left+327,y-13,{size:9,align:'right',max:35});
     text(money(item.cents),left+419,y-13,{size:9,align:'right',max:83});
     text(money(item.cents*item.qty),right-8,y-13,{size:9,bold:true,align:'right',max:85});
     y-=height;
   }
   continueSale(sale,24);
   box(left,y-23,width,23,'soft');
   text('Subtotal '+money(subtotal(sale.items))+'  |  Desconto '+money(sale.discount??0),left+8,y-15,{size:9,max:325});
   text('TOTAL '+money(sale.amount),right-8,y-15,{size:10,bold:true,align:'right',max:165});
   y-=24;
   if(sale.coupon){
     continueSale(sale,16);
     paragraph('Cupom: '+sale.coupon.code+' ('+percentage(sale.coupon.rate)+')',left+8,width-16,{size:9});
   }
   if(sale.method==='Dinheiro'){
     continueSale(sale,16);
     paragraph('Recebido: '+money(sale.received)+'   |   Troco: '+money(sale.received-sale.amount),left+8,width-16,{size:9});
   }
   y-=12;
 }
 section('Cancelamentos do dia',82);
 if(!cancellations.length) paragraph('Nenhum cancelamento registrado nessa data.',left,width);
 for(const sale of cancellations){
   const event=sale.cancellation;
   ensure(74);
   box(left,y-22,width,22,'soft');
   text('Venda nº '+sale.number+'  |  '+sale.method,left+8,y-15,{size:10,bold:true,max:280});
   text(money(sale.amount),right-8,y-15,{size:10,bold:true,color:'red',align:'right',max:160});
   y-=24;
   paragraph(dateTime(event.date)+'  |  Operador: '+event.operator,left+8,width-16,{size:9});
   paragraph('Motivo: '+event.reason,left+8,width-16,{size:10,color:'ink'});
   y-=8;
 }
 page();
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const logoBinary=atob(LC_PDF_LOGO);
 objects.push('<< /Type /XObject /Subtype /Image /Width '+LC_LOGO_WIDTH+' /Height '+LC_LOGO_HEIGHT+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+logoBinary.length+' >>\nstream\n'+logoBinary+'\nendstream');
 const ids=pages.map(stream=>{
   const id=objects.length;
   objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents '+(id+1)+' 0 R >>');
   objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
   return id+' 0 R';
 });
 objects[2]='<< /Type /Pages /Count '+pages.length+' /Kids ['+ids.join(' ')+'] >>';
 let pdf='%PDF-1.4\n';
 const offsets=['0000000000 65535 f \n'];
 for(let id=1;id<objects.length;id++){
   offsets.push(String(pdf.length).padStart(10,'0')+' 00000 n \n');
   pdf+=id+' 0 obj\n'+objects[id]+'\nendobj\n';
 }
 const xref=pdf.length;
 return pdf+'xref\n0 '+objects.length+'\n'+offsets.join('')+'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
}
function reportSummary(){
 const date=$('reportDate').value;
 const sales=reportSales(date);
 const cancellations=dailyCancellations(date);
 const totals=reportTotals(sales,cancellations);
 const summary=$('reportSummary');
 summary.replaceChildren();
 if(date){
   for(const [label,value] of [['Vendas registradas',sales.length],['Total registrado',money(totals.gross)],['Cancelamentos',money(totals.refunds)],['Líquido do dia',money(totals.net)]]){
     const card=node('div',label,'metric');
     card.append(node('strong',value));
     summary.append(card);
   }
 } else summary.append(node('p','Selecione a data.'));

 $('reportDownload').disabled=!date;
}
$('reportDate').onchange=reportSummary;
$('dayReportBtn').onclick=()=>{
 $('reportDate').value=dayKey(new Date());
 $('reportError').textContent='';
 reportSummary(); show('dayReportDialog');
};
$('reportDownload').onclick=async ()=>{
 const date=$('reportDate').value;
 if(!date||$('reportDownload').disabled) return;
 $('reportDownload').disabled=$('reportDate').disabled=true;
 $('reportLoading').hidden=false;
 $('reportError').textContent='';
 try{
   await waitForFeedback(180);
   if(!$('dayReportDialog').open) return;
   download('relatorio-vendas-'+date+'.pdf','application/pdf',makeReportPdf(date,reportSales(date)));
 } catch(problem){$('reportError').textContent=problem.message;}
 finally{
   $('reportLoading').hidden=true;
   $('reportDate').disabled=false;
   reportSummary();
 }
};
function filteredSales(){
 const date=$('salesDate').value;
 return operatorSales().filter(sale=>!date || new Date(sale.date).toLocaleDateString('sv-SE')===date);
}
function renderSales(){
 $('salesList').replaceChildren(...filteredSales().map(sale=>{
   const row=node('div',undefined,'row');
   const label=node('div','Nº '+sale.number+' · '+money(sale.amount));
   label.append(node('div',dateTime(sale.date)+' · '+sale.method,'hint'));
   const controls=node('div',undefined,'row');
   controls.append(button('Comprovante',()=>{$('salesDialog').close(); receipt(sale);}));
   if(sale.cancellation) label.append(node('div','Cancelada · '+dateTime(sale.cancellation.date)+' · '+sale.cancellation.reason,'error'));
   else controls.append(button('Cancelar venda',()=>openCancellation(sale),'danger'));
   row.append(label,controls);
   return row;
 }));
 if(!$('salesList').children.length) $('salesList').append(node('p','Nenhuma venda nesse período.'));
}
function updateCancelReason(){
 const other=$('cancelReason').value==='other';
 $('otherCancelReasonLabel').hidden=!other;
 $('otherCancelReason').disabled=!other;
 $('otherCancelReason').required=other;
}
$('cancelReason').onchange=()=>{
 updateCancelReason();
 if($('cancelReason').value==='other') $('otherCancelReason').focus();
};
let saleToCancel=null;
function openCancellation(sale){
 saleToCancel=sale.number;
 $('cancelSaleForm').reset();
 updateCancelReason();
 $('cancelSaleSummary').textContent='Venda nº '+sale.number+' · '+money(sale.amount)+' · '+sale.method;
 $('cancelPaymentHint').textContent=sale.method==='Dinheiro'?'Devolva o valor ao cliente. O PDV registra a saída no caixa aberto.':
   sale.amount>0?'Faça o estorno no meio de pagamento antes de confirmar o cancelamento no PDV.':'Esta venda foi registrada sem cobrança.';
 show('cancelSaleDialog');
}
form('cancelSaleForm',values=>{
 requireRegister();
 const sale=state.sales.find(item=>item.number===saleToCancel);
 if(!sale||sale.cancellation) throw new Error('Esta venda já foi cancelada ou não está disponível.');
 const selected=[...$('cancelReason').options].some(option=>option.value===values.reason&&!option.disabled);
 if(!selected) throw new Error('Selecione um motivo do cancelamento.');
 const reason=values.reason==='other'?(values.otherReason??'').trim():values.reason;
 if(!reason) throw new Error('Descreva o motivo do cancelamento.');
 if(sale.method==='Dinheiro'&&sale.amount>registerStats(state.register).expected){
   throw new Error('O caixa aberto não tem saldo em dinheiro suficiente para registrar a devolução.');
 }
 const quantities=new Map();
 for(const item of sale.items) quantities.set(item.id,(quantities.get(item.id)??0)+item.qty);
 const catalogIds=new Set(state.catalog.map(product=>product.id));
 const removedProducts=sale.items.some(item=>!item.manual && !catalogIds.has(item.id));
 const cancellation={date:new Date().toISOString(),reason,registerId:state.register.id,operator:state.register.operator};
 const catalog=state.catalog.map(product=>({...product,stock:product.stock+(quantities.get(product.id)??0)}));
 update({catalog,sales:state.sales.map(item=>item===sale?{...item,cancellation}:item)});
 $('cancelSaleDialog').close(); render(); renderSales();
 status('Venda nº '+sale.number+' cancelada.'+(removedProducts?' O saldo foi devolvido aos produtos ainda cadastrados.':' Estoque atualizado.'));
});
$('salesDate').onchange=renderSales;
$('salesBtn').onclick=()=>{renderSales();show('salesDialog');};
function download(filename,mime,contents){
 const payload=mime==='application/pdf' && typeof contents==='string' ? Uint8Array.from(contents, ch=>ch.charCodeAt(0)&255) : contents;
 const url=URL.createObjectURL(new Blob([payload],{type:mime}));
 const link=node('a');
 link.href=url;
 link.download=filename;
 link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const csvFreeText=value=>/^[\s]*[=+@-]/.test(value)?"'"+value:value;
$('exportBtn').onclick=()=>{
 const rows=[['Venda','Data','Pagamento','Total (R$)','Desconto (R$)','Situação','Data de cancelamento','Motivo do cancelamento'],
   ...filteredSales().map(sale=>[sale.number,dateTime(sale.date),sale.method,decimal(sale.amount),decimal(sale.discount??0),sale.cancellation?'Cancelada':'Concluída',sale.cancellation?dateTime(sale.cancellation.date):'',csvFreeText(sale.cancellation?.reason??'')])];
 download('vendas.csv','text/csv;charset=utf-8','\uFEFF'+rows.map(row=>row.map(field=>'"'+String(field).replaceAll('"','""')+'"').join(';')).join('\r\n'));
};
$('backupBtn').onclick=()=>download('caixa-rapido-dados.json','application/json',JSON.stringify(state,null,2));
let restoreCandidate=null;
let restoreRead=0;
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;
const isoDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const textValue=value=>typeof value==='string';
function validateBackup(value){
 const idList=(list,key)=>new Set(list.map(item=>item[key])).size===list.length;
 const line=item=>item&&textValue(item.name)&&textValue(item.id)&&nonnegative(item.cents)&&Number.isSafeInteger(item.qty)&&item.qty>0;
 const cancellation=item=>item&&isoDate(item.date)&&textValue(item.reason)&&textValue(item.registerId)&&textValue(item.operator);
 const sale=item=>item&&Number.isSafeInteger(item.number)&&item.number>0&&isoDate(item.date)&&textValue(item.method)&&nonnegative(item.amount)&&nonnegative(item.received)&&item.received>=item.amount&&nonnegative(item.discount??0)&&Array.isArray(item.items)&&item.items.length>0&&item.items.every(line)&&(!item.cancellation||cancellation(item.cancellation));
 const movement=item=>item&&['in','out'].includes(item.kind)&&nonnegative(item.amount)&&textValue(item.note)&&isoDate(item.date);
 const register=item=>item&&textValue(item.id)&&textValue(item.operator)&&isoDate(item.opened)&&nonnegative(item.float)&&Array.isArray(item.movements)&&item.movements.every(movement);
 const catalog=item=>item&&textValue(item.id)&&textValue(item.name)&&nonnegative(item.cents)&&textValue(item.sku)&&textValue(item.barcode)&&nonnegative(item.stock);
 const coupon=item=>item&&textValue(item.code)&&Number.isInteger(item.rate)&&item.rate>0&&item.rate<=10000;
 const pix=item=>item&&['pixKey','receiver','bank','city'].every(key=>textValue(item[key]));
 const storeProfile=item=>item&&Object.keys(defaultStore).every(key=>item[key]===undefined||textValue(item[key]));
 if(value?.fiados&&(!Array.isArray(value.fiados)||!value.fiados.every(f=>f&&textValue(f.customer)&&nonnegative(f.amount)&&Array.isArray(f.payments))))throw new Error('Dados de fiados inválidos.');
 if(!value||!Array.isArray(value.catalog)||!value.catalog.every(catalog)||!idList(value.catalog,'id')||
    !Array.isArray(value.sales)||!value.sales.every(sale)||!idList(value.sales,'number')||
    !nonnegative(value.nextNumber)||value.nextNumber<1||value.sales.some(item=>item.number>=value.nextNumber)||
    !Array.isArray(value.cart)||!value.cart.every(line)||!idList(value.cart,'id')||
    value.cart.some(item=>!value.catalog.some(product=>product.id===item.id))||
    !nonnegative(value.discount)||value.discount>subtotal(value.cart)||
    !Array.isArray(value.closed)||!value.closed.every(item=>register(item)&&isoDate(item.ended)&&nonnegative(item.counted)&&nonnegative(item.expected)&&nonnegative(item.gross))||
    !(value.register===null||register(value.register))||
    (value.pix&&!pix(value.pix))||(value.store&&!storeProfile(value.store))||
    (value.appliedCoupon&&!coupon(value.appliedCoupon))||
    (value.coupons&&(!Array.isArray(value.coupons)||!value.coupons.every(coupon)))){
   throw new Error('Selecione um backup JSON válido do Caixa Rápido.');
 }
 return {...value,stock100Applied:true};
}
$('restoreBtn').onclick=()=>{
 $('restoreForm').reset();
 restoreCandidate=null;
 restoreRead++;
 $('restoreSummary').textContent='';
 $('applyRestore').disabled=true;
 show('restoreDialog');
};
$('saveBeforeRestore').onclick=$('backupBtn').onclick;
$('restoreFile').onchange=async event=>{
 const attempt=++restoreRead;
 const file=event.target.files[0];
 const feedback=$('restoreDialog').querySelector('.error');
 restoreCandidate=null;
 $('applyRestore').disabled=true;
 $('restoreSummary').textContent='';
 feedback.textContent='';
 if(!file) return;
 try {
   const candidate=validateBackup(JSON.parse(await file.text()));
   if(attempt!==restoreRead) return;
   restoreCandidate=candidate;
   $('restoreSummary').textContent=candidate.catalog.length+' produtos e '+candidate.sales.length+' vendas no backup. A restauração substitui os dados deste navegador.';
   $('applyRestore').disabled=false;
 } catch {
   if(attempt===restoreRead) feedback.textContent='Não foi possível ler o arquivo como um backup válido do Caixa Rápido.';
 }
};
form('restoreForm',()=>{
 if(!restoreCandidate) throw new Error('Selecione um backup válido.');
 if(!confirm('Substituir os dados atuais pelos dados deste backup?')) return;
 persist(restoreCandidate);
 restoreCandidate=null;
 $('restoreDialog').close();
 $('salesDialog').close();
 $('search').value='';
 render();
 status('Backup restaurado.');
});
function registerStats(register){
 const sales=state.sales.filter(sale=>sale.registerId===register.id);
 const cash=sales.filter(sale=>sale.method==='Dinheiro').reduce((sum,sale)=>sum+sale.amount,0);
 const moves=register.movements.reduce((sum,move)=>sum+(move.kind==='in'?move.amount:-move.amount),0);
 const cancellations=state.sales.filter(sale=>sale.cancellation?.registerId===register.id);
 const cashRefunds=cancellations.filter(sale=>sale.method==='Dinheiro').reduce((sum,sale)=>sum+sale.amount,0);
 const refunds=cancellations.reduce((sum,sale)=>sum+sale.amount,0);
 return {count:sales.length,gross:sales.reduce((sum,sale)=>sum+sale.amount,0),cash,refunds,cashRefunds,expected:register.float+cash+moves-cashRefunds};
}
function renderRegister(){
 const register=state.register;
 $('movementForm').hidden=$('closeForm').hidden=!register;
 $('movements').replaceChildren(...(register?.movements??[]).map(move=>node('p',
   (move.kind==='in'?'Entrada':'Retirada')+' · '+money(move.amount)+' · '+move.note+' · '+dateTime(move.date))));
 $('registerMetrics').replaceChildren();
 if(register){
   const stats=registerStats(register);
   const metrics=node('div',undefined,'metrics');
   [['Abertura',money(register.float)],['Vendas ('+stats.count+')',money(stats.gross)],['Vendas em dinheiro',money(stats.cash)],['Cancelamentos',money(stats.refunds)],['Devoluções em dinheiro',money(stats.cashRefunds)],['Dinheiro esperado',money(stats.expected)]].forEach(([label,value])=>{
     const block=node('div',label,'metric');
     block.append(node('strong',value)); metrics.append(block);
   });
   $('registerMetrics').append(node('p',register.operator+' · desde '+dateTime(register.opened)),metrics);
 } else $('registerMetrics').append(node('p','Caixa fechado.'));
 $('pastRegisters').replaceChildren(...state.closed.map(record=>{
   const entry=node('details');
   entry.append(node('summary',dateTime(record.ended)+' · '+record.operator),
     node('p','Vendas: '+money(record.gross)+' · Dinheiro esperado: '+money(record.expected)),
     node('p','Contado: '+money(record.counted)+' · Diferença: '+money(record.counted-record.expected)));
   return entry;
 }));
 if(!state.closed.length) $('pastRegisters').append(node('p','Nenhum fechamento registrado.'));
}
$('registerBtn').onclick=()=>{renderRegister(); show('registerDialog');};
form('movementForm',values=>{
 requireRegister();
 const note=values.note.trim();
 const cents=requireAmount(values.amount,true);
 if(!note) throw new Error('Informe o motivo do movimento.');
 if(values.kind==='out' && cents>registerStats(state.register).expected) throw new Error('A retirada excede o dinheiro esperado no caixa.');
 const move={kind:values.kind,amount:cents,note,date:new Date().toISOString()};
 update({register:{...state.register,movements:[move,...state.register.movements]}});
 $('movementForm').reset(); renderRegister();
});
form('closeForm',values=>{
 requireRegister();
 if(state.cart.length) throw new Error('Finalize ou limpe a venda aberta antes do fechamento.');
 const counted=requireAmount(values.amount);
 const record={...state.register,...registerStats(state.register),counted,ended:new Date().toISOString()};
 update({register:null,closed:[record,...state.closed]});
 if(activeOperatorId==='legacy') {activeOperatorId='';}

 $('closeForm').reset(); renderRegister(); render();
 status('Caixa fechado. Diferença de dinheiro: '+money(record.counted-record.expected)+'.');
});

render();
$('startupMessage').hidden=true;

;

(function(){
  const menu=document.querySelector('#mainMenu nav');
  const header=document.querySelector('header');
  if(menu && header){
    const aside=document.createElement('aside');aside.className='lc-sidebar';aside.setAttribute('aria-label','Navegação principal');
    const title=document.createElement('p');title.className='lc-side-title';title.textContent='Gerenciamento';aside.appendChild(title);
    aside.appendChild(menu);header.insertAdjacentElement('afterend',aside);const f=document.createElement('button');f.type='button';f.id='fiadosBtn';f.className='lc-fiados-nav';f.innerHTML='<i class="fa-solid fa-hand-holding-dollar" aria-hidden="true"></i> Fiados / Contas a receber';aside.appendChild(f);
  }
  const btn=document.getElementById('checkoutBtn');if(btn)btn.textContent='Finalizar venda · F4';
})();

;

(function(){
 const icons={clearBtn:'\uf12d',discountBtn:'\uf02b',priceLookup:'\uf002',lastReceipt:'\uf15c',dayReportBtn:'\uf201',checkoutBtn:'\uf09d'};
 for(const [id,glyph] of Object.entries(icons)){
  const el=document.getElementById(id);if(!el||el.querySelector('.menuIcon'))continue;
  const span=document.createElement('span');span.className='menuIcon';span.setAttribute('aria-hidden','true');span.textContent=glyph;el.prepend(span);
 }
})();

;

(function(){
const el=id=>document.getElementById(id);
const moneyBR=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const parseBR=v=>{const n=String(v).trim().replace(/\./g,'').replace(',','.');return /^\d+(\.\d{1,2})?$/.test(n)?Math.round(Number(n)*100):NaN};
const freshId=()=> 'avulso-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
el('manualBtn').onclick=()=>{el('manualForm').reset();el('manualDialog').querySelector('.error').textContent='';el('manualDialog').showModal()};
el('manualForm').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget.elements;const price=parseBR(f.price.value),qty=Number(f.qty.value);try{if(!state.register)throw Error('Abra o caixa antes de lançar um item.');if(!Number.isSafeInteger(price)||price<=0)throw Error('Informe um valor válido maior que zero.');if(!Number.isInteger(qty)||qty<1||qty>99999)throw Error('Quantidade inválida.');const name=f.name.value.trim();if(!name)throw Error('Informe a descrição.');const item={id:freshId(),name,sku:f.kind.value,cents:price,qty,manual:true};setCart([...state.cart,item]);el('manualDialog').close();status('Item avulso adicionado à venda.')}catch(err){el('manualDialog').querySelector('.error').textContent=err.message}});
function renderFiados(){const list=el('fiadoList');list.replaceChildren();const debts=(state.fiados||[]).filter(d=>(!d.saleNumber||!state.sales.find(s=>s.number===d.saleNumber)?.cancellation));const open=debts.filter(d=>d.amount-d.payments.reduce((a,p)=>a+p.amount,0)>0);el('fiadoTotal').textContent=moneyBR(open.reduce((a,d)=>a+d.amount-d.payments.reduce((x,p)=>x+p.amount,0),0));el('fiadoCount').textContent=new Set(open.map(d=>d.customer.toLowerCase())).size;const query=el('fiadoSearch').value.trim().toLowerCase();for(const d of debts.filter(d=>d.customer.toLowerCase().includes(query))){const paid=d.payments.reduce((a,p)=>a+p.amount,0),balance=d.amount-paid;const card=document.createElement('div');card.className='lc-debt';const title=document.createElement('strong');title.textContent=d.customer+(d.saleNumber?' · Venda nº '+d.saleNumber:' · Cadastro manual')+(d.description?' · '+d.description:'');const info=document.createElement('p');info.textContent='Total: '+moneyBR(d.amount)+' · Recebido: '+moneyBR(paid)+' · Saldo: '+moneyBR(balance)+(d.due?' · Venc.: '+d.due.split('-').reverse().join('/'):'');card.append(title,info);if(balance>0){const amount=document.createElement('input');amount.placeholder='Valor recebido (R$)';amount.inputMode='decimal';amount.setAttribute('aria-label','Valor recebido de '+d.customer);const method=document.createElement('select');for(const m of ['Dinheiro','Pix','Cartão','Outro'])method.add(new Option(m,m));const btn=document.createElement('button');btn.type='button';btn.textContent='Registrar recebimento';btn.onclick=()=>{const value=parseBR(amount.value);if(!Number.isSafeInteger(value)||value<=0||value>balance){alert('Informe um valor entre R$ 0,01 e '+moneyBR(balance));return}if(method.value==='Dinheiro'&&!state.register){alert('Abra o caixa para registrar recebimento em dinheiro.');return}const pay={amount:value,method:method.value,date:new Date().toISOString()};const fiados=(state.fiados||[]).map(x=>x.id===d.id?{...x,payments:[...x.payments,pay]}:x);const patch={fiados};if(method.value==='Dinheiro')patch.register={...state.register,movements:[{kind:'in',amount:value,note:'Recebimento de fiado: '+d.customer+(d.saleNumber?' (venda '+d.saleNumber+')':' (cadastro manual)'),date:pay.date},...state.register.movements]};try{update(patch);renderFiados();status('Recebimento registrado: '+moneyBR(value))}catch(err){alert(err.message)}};card.append(amount,method,btn)}else{const settled=document.createElement('span');settled.textContent='Quitado';card.append(settled)}list.append(card)}if(!list.children.length){const p=document.createElement('p');p.textContent='Nenhum fiado encontrado.';list.append(p)}}
el('newFiadoBtn').onclick=()=>{el('newFiadoForm').reset();el('newFiadoError').textContent='';el('newFiadoDialog').showModal()};
el('newFiadoForm').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget.elements;const customer=f.customer.value.trim(),description=f.description.value.trim(),amount=parseBR(f.amount.value);try{if(!customer||!description)throw Error('Informe o cliente e a descrição.');if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Informe um valor válido maior que zero.');const debt={id:'fiado-manual-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),saleNumber:null,customer,description,due:f.due.value,amount,payments:[],date:new Date().toISOString()};update({fiados:[...(state.fiados||[]),debt]});el('newFiadoDialog').close();renderFiados();status('Fiado cadastrado para '+customer+'.')}catch(err){el('newFiadoError').textContent=err.message}});
el('fiadosBtn').onclick=()=>{el('fiadoSearch').value='';renderFiados();el('fiadosDialog').showModal()};el('fiadoSearch').oninput=renderFiados;
// Fix icons without relying on the broken embedded icon font.
const paths={manualBtn:'M12 5v14 M5 12h14',clearBtn:'M3 6h18 M8 6V4h8v2 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',discountBtn:'M20 12l-8 8-9-9V4h7z M7.5 8h.01',priceLookup:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M17 17l5 5',lastReceipt:'M6 2h12v20l-3-2-3 2-3-2-3 2z M9 7h6 M9 11h6 M9 15h4',dayReportBtn:'M4 20V10 M10 20V4 M16 20v-8 M22 20V7',checkoutBtn:'M3 7h18v12H3z M3 11h18 M7 16h4',fiadosBtn:'M3 12h4l3 3 5-5 6 1 M12 3v3 M9 6h6'};
for(const [id,d] of Object.entries(paths)){const b=el(id);if(!b)continue;b.querySelectorAll('.menuIcon').forEach(i=>i.remove());const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('width','17');icon.setAttribute('height','17');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','2');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);icon.append(path);b.prepend(icon)}
})();

;

(function(){
 const $=id=>document.getElementById(id), dlg=$('budgetDialog'), lines=$('budgetLines');
 const fmt=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const parse=v=>{let x=String(v).trim().replace(/\s/g,'');if(x.includes(','))x=x.replace(/\./g,'').replace(',','.');const n=Number(x);return Number.isFinite(n)&&n>=0?Math.round(n*100):NaN};
 const menu=document.querySelector('.lc-sidebar');
 if(menu){const b=document.createElement('button');b.type='button';b.id='budgetBtn';b.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 3h10l4 4v14H3V3zM7 11h10M7 15h10M7 19h6"/></svg> Orçamentos';menu.appendChild(b);b.onclick=()=>{if(!lines.children.length)addLine();if(!$('budgetValidity').value){const d=new Date();d.setDate(d.getDate()+15);$('budgetValidity').value=d.toISOString().slice(0,10)}dlg.showModal()};}
 $('budgetClose').onclick=()=>dlg.close();
 function addLine(desc='',qty='1',price=''){const r=document.createElement('div');r.className='budget-line';r.innerHTML='<input aria-label="Descrição" class="b-desc" placeholder="Produto ou serviço" required maxlength="160"><input aria-label="Quantidade" class="b-qty" type="number" min="1" max="99999" step="1" required><input aria-label="Valor unitário" class="b-price" placeholder="0,00" required inputmode="decimal"><strong class="budget-line-total">R$ 0,00</strong><button type="button" title="Remover item">×</button>';r.querySelector('.b-desc').value=desc;r.querySelector('.b-qty').value=qty;r.querySelector('.b-price').value=price;r.querySelector('button').onclick=()=>{r.remove();calc()};r.querySelectorAll('input').forEach(i=>i.addEventListener('input',calc));lines.appendChild(r);calc()}
 function items(){return [...lines.children].map(r=>({desc:r.querySelector('.b-desc').value.trim(),qty:Number(r.querySelector('.b-qty').value),unit:parse(r.querySelector('.b-price').value)}))}
 function calc(){let sum=0;[...lines.children].forEach((r,i)=>{const v=items()[i];const total=Number.isFinite(v.unit)?v.unit*v.qty:0;r.querySelector('.budget-line-total').textContent=fmt(total);sum+=total});$('budgetTotal').textContent='Total: '+fmt(sum)}
 $('budgetAdd').onclick=()=>addLine();$('budgetClear').onclick=()=>{if(!confirm('Limpar os dados do orçamento?'))return;$('budgetForm').reset();lines.replaceChildren();addLine()};addLine();
 function pdfEscape(s){return Array.from(String(s)).map(ch=>{const c=ch.charCodeAt(0);if(c>255)return '?';if(c<32||c>126||'()\\'.includes(ch))return '\\'+c.toString(8).padStart(3,'0');return ch}).join('')}
 function makePdf(data){
  const pages=[];let cmd=[],y=694;const dark='0.18 0.07 0.25',purple='0.32 0.13 0.42',gray='0.44 0.42 0.48';
  const tx=(s,x,yy,size=10,bold=false,color=dark)=>cmd.push(`BT /F${bold?2:1} ${size} Tf ${color} rg 1 0 0 1 ${x} ${yy} Tm (${pdfEscape(s)}) Tj ET`);
  const rect=(x,yy,w,h,color)=>cmd.push(`${color} rg ${x} ${yy} ${w} ${h} re f`);
  const safe=s=>String(s||'').replace(/\s+/g,' ').trim();
  function wrap(s,max=82){const words=safe(s).split(' '),out=[];let line='';for(const word of words){if((line+' '+word).length>max&&line){out.push(line);line=''}line+=(line?' ':'')+word;while(line.length>max){out.push(line.slice(0,max));line=line.slice(max)}}if(line)out.push(line);return out}
  function header(){rect(0,744,595,98,'1 1 1');rect(0,739,595,4,purple);cmd.push('q 146 0 0 49 36 779 cm /Logo Do Q');tx('ORÇAMENTO',205,806,18,true,dark);tx(safe(data.store),205,784,10,false,gray);tx('Nº '+data.number,205,767,10,true,purple);y=716}
  function page(){rect(36,39,523,1,'0.87 0.84 0.90');tx('ListCaixa  |  Orçamento comercial',36,24,8,false,gray);tx('Página '+(pages.length+1),495,24,8,false,gray);pages.push(cmd.join('\n')+'\n');cmd=[];header()}
  function need(h){if(y-h<68)page()}
  function block(label,value){need(32);tx(label,42,y,9,true,purple);y-=15;for(const l of wrap(value,90)){need(14);tx(l,42,y,10);y-=14}y-=7}
  header();tx('Emitido em '+new Date().toLocaleDateString('pt-BR')+'  |  Válido até '+data.validity,42,y,10,false,gray);y-=31;
  block('DADOS DA EMPRESA EMITENTE',data.store);if(data.storeTaxId)block('CPF / CNPJ DA EMPRESA',data.storeTaxId);if(data.address)block('ENDEREÇO DA EMPRESA',data.address);if(data.storePhone)block('TELEFONE DA EMPRESA',data.storePhone);
  block('DESTINATÁRIO',data.client+(data.doc?'  |  '+data.doc:''));if(data.phone)block('CONTATO',data.phone);if(data.contact)block('RESPONSÁVEL',data.contact);
  need(45);rect(36,y-21,523,26,purple);tx('DESCRIÇÃO',44,y-12,9,true,'1 1 1');tx('QTD.',360,y-12,9,true,'1 1 1');tx('UNITÁRIO',411,y-12,9,true,'1 1 1');tx('TOTAL',502,y-12,9,true,'1 1 1');y-=30;
  for(const item of data.items){const parts=wrap(item.desc,48);need(Math.max(30,parts.length*13+10));rect(36,y-(parts.length*13+10),523,parts.length*13+10,'0.98 0.97 0.99');parts.forEach((part,i)=>tx(part,44,y-13-i*13,9));tx(String(item.qty),366,y-13,9);tx(fmt(item.unit),410,y-13,9);tx(fmt(item.unit*item.qty),492,y-13,9,true);y-=parts.length*13+14}
  need(50);rect(36,y-43,523,43,'0.94 0.91 0.97');tx('VALOR TOTAL',46,y-26,11,true,purple);tx(fmt(data.total),422,y-28,17,true,dark);y-=64;
  if(data.payment)block('CONDIÇÕES DE PAGAMENTO',data.payment);
  if(data.notes){need(40);tx('OBSERVAÇÕES',42,y,9,true,purple);y-=17;for(const part of safe(data.notes).match(/.{1,90}/g)||[]){need(14);tx(part,42,y,9);y-=14}y-=8}
  
  need(25);tx('Este documento é um orçamento, não um comprovante de pagamento.',42,y-9,9,false,gray);
  page();
  const objects=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
  const binary=atob(LC_PDF_LOGO);objects.push('<< /Type /XObject /Subtype /Image /Width '+LC_LOGO_WIDTH+' /Height '+LC_LOGO_HEIGHT+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+binary.length+' >>\nstream\n'+binary+'\nendstream');
  const ids=pages.map(stream=>{const id=objects.length;objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Logo 5 0 R >> >> /Contents '+(id+1)+' 0 R >>');objects.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');return id+' 0 R'});
  objects[2]='<< /Type /Pages /Count '+pages.length+' /Kids ['+ids.join(' ')+'] >>';let pdf='%PDF-1.4\n';const offsets=['0000000000 65535 f \n'];for(let i=1;i<objects.length;i++){offsets.push(String(pdf.length).padStart(10,'0')+' 00000 n \n');pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n'}const start=pdf.length;return pdf+'xref\n0 '+objects.length+'\n'+offsets.join('')+'trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
 }
 $('budgetForm').onsubmit=e=>{e.preventDefault();try{const arr=items();if(!arr.length||arr.some(i=>!i.desc||!Number.isInteger(i.qty)||i.qty<1||!Number.isFinite(i.unit)||i.unit<=0))throw Error('Preencha descrição, quantidade e preço válido em todos os itens.');const profile=store();const data={client:$('budgetClient').value.trim(),doc:$('budgetDoc').value.trim(),phone:$('budgetPhone').value.trim(),contact:$('budgetContact').value.trim(),validity:new Date($('budgetValidity').value+'T12:00:00').toLocaleDateString('pt-BR'),payment:$('budgetPayment').value.trim(),notes:$('budgetNotes').value.trim(),store:profile.storeName,storeTaxId:profile.taxId,address:profile.address,storePhone:profile.phone,items:arr,total:arr.reduce((s,i)=>s+i.unit*i.qty,0),number:Date.now().toString().slice(-8)};if(!data.client||!$('budgetValidity').value)throw Error('Informe destinatário e validade.');download('orcamento-listcaixa-'+data.number+'.pdf','application/pdf',makePdf(data));$('budgetError').textContent='';}catch(err){$('budgetError').textContent=err.message}};
})();

;

// Endereço do serviço ListCaixa.
// O servidor exige LC_API_KEY para consultar/gravar dados. Nunca publique essa chave no HTML.
window.LISTCAIXA_API = {
  url: 'https://script.google.com/macros/s/AKfycbzGyQTR44YR_oYIa9ye6lNnp35DH-O5JSTAWQiYAO411p_A2mmbEZi4wa2ZkDbXRxBi/exec',
  mode: 'cloud',
  storage: 'cloud',
  connected: false
};
// Teste somente de disponibilidade; nao transmite informacoes do caixa.
window.listCaixaTestarServidor = async function() {
  const response = await fetch(window.LISTCAIXA_API.url + '?action=health', {redirect:'follow',cache:'no-store'});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const data = await response.json();
  if (!data.ok || data.app !== 'ListCaixa') throw new Error('Resposta inesperada do servidor');
  return data;
};

;

(function(){
 const gate=document.getElementById('lcCloudGate'),msg=document.getElementById('lcCloudMessage'),error=document.getElementById('lcCloudError'),indicator=document.getElementById('lcCloudIndicator');
 const keyInput=document.getElementById('lcCloudKey');const KEY_STORAGE='listcaixa_integration_key';let baseRevision='',checkingAccess=false;let key='',queue=Promise.resolve(),busy=0,seq=0,changes=0;
 const url=window.LISTCAIXA_API.url;
 function loadRemote(action='stateLoad'){
  return new Promise((resolve,reject)=>{
   const callback='lcCb'+Date.now()+'_'+(++seq),script=document.createElement('script');let done=false;
   const timer=setTimeout(()=>finish(new Error('O serviço demorou a responder. Tente novamente.')),20000);
   function finish(err,data){if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();err?reject(err):resolve(data);}
   window[callback]=data=>data&&data.ok?finish(null,data):finish(new Error(data?.error==='Nao autorizado.'?'Key de acesso inválida.':'Não foi possível consultar os dados.'));
   script.onerror=()=>finish(new Error('Não foi possível conectar ao serviço. Tente novamente.'));
   script.src=url+'?action='+action+'&apiKey='+encodeURIComponent(key)+'&callback='+callback+'&_='+Date.now();
   document.head.appendChild(script);
  });
 }
 async function post(payload){
  // text/plain is a CORS simple request. No-cors sends the POST without requiring browser access to the redirected response.
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:controller.signal,redirect:'follow'});}
  catch(e){throw new Error('Não foi possível salvar os dados. Verifique a conexão.');}
  finally{clearTimeout(timer);}
 }
 async function writeRemote(snapshot,removedProductIds,operatorId){
  const revision='lc-'+Date.now()+'-'+(++seq)+'-'+Math.random().toString(36).slice(2);
  await post({action:'stateSave',apiKey:key,version:'2.5.2',baseRevision,operatorId,removedProductIds,state:{...snapshot,_lcRevision:revision}});
  // Never treat opaque HTTP response as proof of saving: verify by reading the actual Sheet state.
  for(let attempt=0;attempt<8;attempt++){
   await new Promise(r=>setTimeout(r,650+attempt*500));
   const check=await loadRemote();
   if(check.access && !applyAccess(check.access)) throw new Error('Acesso temporariamente bloqueado.');
   const observed=check.state?._lcRevision||'';
   if(observed===revision){baseRevision=revision;return;}
   if(observed!==baseRevision) throw new Error('Outro caixa atualizou os dados. Reabra o sistema antes de repetir a operação.');
  }
  throw new Error('O salvamento não foi confirmado. Confira os registros antes de repetir a operação.');
 }
 function readSheetState(response){
  if(response.version!=='2.5.2') throw new Error('O serviço está em uma versão incompatível. Entre em contato com o suporte.');
  if(!Array.isArray(response.state?.catalog)) throw new Error('Não foi possível carregar o catálogo.');
  return response.state;
 }
 function sheetStatus(state){
  const count=state.catalog.length;
  indicator.textContent=count+(count===1?' produto carregado':' produtos carregados');
 }
 function fail(err){if(accessConfig?.blocked)return;queue=Promise.resolve();window.LC_CLOUD_ERROR=true;window.LC_CLOUD_READY=false;$('lcSyncControls').hidden=true;gate.hidden=false;gate.style.display='flex';msg.textContent='Falha na sincronização. Não registre novas vendas até corrigir a conexão.';error.textContent=err.message;indicator.hidden=true;document.getElementById('lcCloudConnect').textContent='Reconectar';}
 function save(next,removedProductIds=[],operatorId=''){
  const snapshot=structuredClone(next);changes++;busy++;indicator.hidden=false;indicator.textContent='Salvando alterações…';indicator.style.color='#7a4b10';
  queue=queue.then(()=>writeRemote(snapshot,removedProductIds,operatorId)).then(()=>{
   if(removedProductIds.length) status('Remoção do estoque confirmada.');
   busy--;if(!busy){sheetStatus(state);indicator.style.color='#197344';}}).catch(err=>{busy=0;fail(err);throw err;});
  queue.catch(()=>{});
 }
 window.LC_CLOUD_SAVE=save;
 const loginForm=$('lcCloudForm'), remember=$('lcCloudRemember');
 const enter=$('lcCloudConnect');
 loginForm.onsubmit=async event=>{
  event.preventDefault();
  if(enter.disabled) return;
  key=keyInput.value.trim();if(!key){error.textContent='Informe a key de acesso.';return;}
  enter.disabled=true;
  error.textContent='';msg.textContent='Validando o acesso…';
  try{
   const r=await loadRemote();
   if(r.version!=='2.5.2') throw new Error('O serviço está em uma versão incompatível. Entre em contato com o suporte.');
   if(!applyAccess(r.access)) return;
   const next=readSheetState(r);
   baseRevision=next._lcRevision||'';
   window.LC_CLOUD_ERROR=false;window.LC_CLOUD_READY=true;window.LISTCAIXA_API.connected=true;
   try{if(remember.checked)localStorage.setItem(KEY_STORAGE,key);else localStorage.removeItem(KEY_STORAGE);}catch(storageError){console.warn('Não foi possível lembrar a chave neste navegador.',storageError);}
   loadOperatorView(next);
   gate.hidden=true;gate.style.display='none';keyInput.value='';$('lcSyncControls').hidden=false;sheetStatus(state);indicator.style.color='#197344';
   render();if(typeof renderCatalog==='function')renderCatalog();if(typeof renderSales==='function')renderSales();if(typeof renderRegister==='function')renderRegister();if(typeof renderFiados==='function')renderFiados();
   const refresh=$('lcRefreshSheets');
    refresh.onclick=async()=>{
     if(busy){alert('Aguarde a conclusão do salvamento antes de atualizar.');return;}
     const startedAt=changes;
     refresh.disabled=true;indicator.textContent='Carregando dados…';
     try{const fresh=await loadRemote();if(changes!==startedAt)throw new Error('O caixa mudou durante a consulta. Aguarde o salvamento e atualize novamente.');if(!applyAccess(fresh.access))return;const next=readSheetState(fresh);baseRevision=next._lcRevision||'';loadOperatorView(next);render();if(typeof renderCatalog==='function')renderCatalog();if(typeof renderSales==='function')renderSales();if(typeof renderRegister==='function')renderRegister();if(typeof renderFiados==='function')renderFiados();sheetStatus(state);}
     catch(e){indicator.textContent='Falha ao atualizar';alert(e.message);}
     finally{refresh.disabled=false;}
    };
  }catch(e){fail(e);}
  finally{enter.disabled=false;}
 };
 $('operatorForm').onsubmit=async event=>{
  event.preventDefault();
  if(!window.LC_CLOUD_READY) return;
  const form=event.currentTarget, submit=form.querySelector('button[type=submit]');
  if(submit.disabled)return;
  const name=form.elements.name.value.trim().replace(/\s+/g,' ');
  const error=$('operatorDialog').querySelector('.error');
  if(!name){error.textContent='Informe o nome do operador.';return;}
  if(accessConfig.operators.some(operator=>operator.name.toLowerCase()===name.toLowerCase())){
   error.textContent='Já existe um operador com esse nome.';return;
  }
  if(accessConfig.total>=accessConfig.limit){error.textContent='Limite de operadores atingido.';return;}
  submit.disabled=true;
  error.textContent='';
  try{
   await post({action:'operatorCreate',apiKey:key,name});
   const result=await loadRemote('access');
   if(!applyAccess(result.access))return;
   if(!result.access.operators.some(operator=>operator.name.toLowerCase()===name.toLowerCase())){
    throw new Error('O cadastro não foi confirmado. Confira o limite de operadores.');
   }
   $('operatorDialog').close();
   renderOperators();
  }catch(err){error.textContent=err.message;}
  finally{submit.disabled=false;}
 };
 async function checkAccess(){
  if(!window.LC_CLOUD_READY||checkingAccess)return;
  checkingAccess=true;
  try{
   const result=await loadRemote('access');
   if(applyAccess(result.access)) renderOperators();
  }catch(_){}
  finally{checkingAccess=false;}
 }
 setInterval(checkAccess,60000);
 window.addEventListener('focus',checkAccess);
 // Único uso de localStorage: lembrar a chave de integração após autenticação bem-sucedida.
 try{const savedKey=localStorage.getItem(KEY_STORAGE);if(savedKey){keyInput.value=savedKey;loginForm.requestSubmit();}}catch(storageError){console.warn('Armazenamento da chave indisponível.',storageError);}
 window.addEventListener('beforeunload',e=>{if(busy>0){e.preventDefault();e.returnValue='Há alterações sendo salvas.';}});
})();

;

(() => {
  const bar=document.getElementById('lcMobileNav');
  const more=document.getElementById('lcMobileMore');
  const mobile=window.matchMedia('(max-width: 850px)');
  function run(event){
    const control=event.target.closest('[data-mobile-target]');
    if(!control || !mobile.matches) return;
    const target=control.dataset.mobileTarget;
    if(target==='focus'){
      window.scrollTo({top:0});
      document.getElementById('search').focus({preventScroll:true});
      return;
    }
    if(target==='more'){
      more.showModal();
      return;
    }
    if(more.open) more.close();
    document.getElementById(target)?.click();
  }
  bar.addEventListener('click',run);
  more.addEventListener('click',run);
  mobile.addEventListener('change',event=>{
    if(!event.matches && more.open) more.close();
  });
})();
