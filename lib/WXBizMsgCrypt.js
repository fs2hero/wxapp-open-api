const crypto = require('crypto');
const XMLParser = require('xml2js');
const Promise = require('bluebird');
const parseXML = Promise.promisify(XMLParser.parseString);
const buildXML = new XMLParser.Builder({ rootName: 'xml', cdata: true, headless: true, renderOpts: { indent: ' ', pretty: 'true' } });

function PKCS7Decoder(buff) {
    let pad = buff[buff.length - 1];
    if (pad < 1 || pad > 32) {
        pad = 0;
    }
    return buff.slice(0, buff.length - pad);
}

function PKCS7Encoder(buff) {
    const blockSize = 32;
    const strSize = buff.length;
    const amountToPad = blockSize - (strSize % blockSize);
    const pad = Buffer.alloc(amountToPad);
    pad.fill(String.fromCharCode(amountToPad));
    return Buffer.concat([buff, pad]);
}
// please decode the url before initializing this function
class WXCrypt {
    constructor(appID, token, encodingAESKey) {
        this.appID = appID;
        this.token = token;
        this.aesKey = Buffer.from(encodingAESKey + '=', 'base64');
        this.iv = this.aesKey.slice(0, 16);
    }

    async xml2obj(xml) {
        return parseXML(xml, { explicitArray: false });
    }

    obj2xml(obj) {
        return buildXML.buildObject(obj);
    }

    decryptMsg(msgSignature, timestamp, nonce, data) {
        const msgEncrypt = data.Encrypt;
        // if(data.ToUserName!=this.appID)throw new Error("ToUserName is invalid");
        if (this.getSignature(timestamp, nonce, msgEncrypt) !== msgSignature) throw new Error('msgSignature is not invalid');
        const decryptedMessage = this.decrypt(msgEncrypt);
        return this.xml2obj(decryptedMessage);
    };

    encryptMsg(replyMsg, opts) {
        const result = {};
        const options = opts || {};
        result.Encrypt = this.encrypt(replyMsg);
        result.Nonce = options.nonce || parseInt((Math.random() * 100000000000), 10);
        result.TimeStamp = options.timestamp || Date.now();

        result.MsgSignature = this.getSignature(result.TimeStamp, result.Nonce, result.Encrypt);

        return this.obj2xml(result);
    }

    encrypt(xmlMsg) {
        const random16 = crypto.pseudoRandomBytes(16);

        const msg = Buffer.from(xmlMsg);

        const msgLength = Buffer.alloc(4);
        msgLength.writeUInt32BE(msg.length, 0);

        const corpId = Buffer.from(this.appID);

        const rawMsg = Buffer.concat([random16, msgLength, msg, corpId]);// randomString + msgLength + xmlMsg + this.corpID;
        const encoded = PKCS7Encoder(rawMsg);
        const cipher = crypto.createCipheriv('aes-256-cbc', this.aesKey, this.iv);
        cipher.setAutoPadding(false);// crypto的padding模式不是PKCS7!!!

        // const cipheredMsg = Buffer.concat([cipher.update(/*encoded*/raw_msg), cipher.final()]);
        const cipheredMsg = Buffer.concat([cipher.update(encoded), cipher.final()]);

        return cipheredMsg.toString('base64');
    }

    decrypt(str) {
        const aesCipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, this.iv);
        aesCipher.setAutoPadding(false);
        let decipheredBuff = Buffer.concat([aesCipher.update(str, 'base64'), aesCipher.final()]);

        decipheredBuff = PKCS7Decoder(decipheredBuff);

        const lenNetOrderCorpid = decipheredBuff.slice(16);

        const msgLen = lenNetOrderCorpid.slice(0, 4).readUInt32BE(0);
        // recoverNetworkBytesOrder(len_netOrder_corpid.slice(0, 4));

        const result = lenNetOrderCorpid.slice(4, msgLen + 4).toString();

        const appId = lenNetOrderCorpid.slice(msgLen + 4).toString();

        if (appId !== this.appID) throw new Error('appId is invalid');

        return result;
    }

    getSignature(timestamp, nonce, encrypt) {
        const rawSignature = [this.token, timestamp, nonce, encrypt].sort().join('');

        const sha1 = crypto.createHash('sha1');
        sha1.update(rawSignature);

        return sha1.digest('hex');
    }
}

module.exports = WXCrypt;
