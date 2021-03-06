(function (node) {



var cryptoWindow =  function (storage){
    if (typeof window==='object' && typeof process==='undefined') {
        if (storage!==false) window.keyStorage = window.keyStorage || window[storage||"localStorage"];
        cryptoWindow = function () {return window;};
        return window;
    }
    var

    WebCrypto = require("node-webcrypto-ossl"),

    webcrypto = new WebCrypto(storage===false?undefined:{
      directory: storage||"key_storage"
    }),
    subtle = webcrypto.subtle,
    keyStorage = webcrypto.keyStorage,
    node_window = { crypto : { subtle : subtle }, keyStorage : keyStorage};

    cryptoWindow = function () {return node_window;};

    return node_window;
};


cryptoWindow.hardCodedPublic=hardCodedPublic;
function hardCodedPublic (cb) {
    var win=cryptoWindow(false),subtle=win.crypto.subtle,
    exported = { kty: 'RSA',
                   key_ops: [ 'verify' ],
                   e: 'AQAB',
                   n:
                    '4Hwq4gKZvqNQ-aPwP0i-PKS_QXM3ImXti1OaRud3t7TK7lFQNFmrrlSg055Yz8ITHcUKq8VsAZ8RuVRfzgbjiKKs8lqR0jSOFjsZjuGu4q4ZDv8RDXQqDJxthRgEly9wmrWqhzfrPZErN3W__5wqpDi8UPvrsH_Wwj7O7N4POLM',
                   alg: 'RS1',
                   ext: true };

    subtle.importKey(
        "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
        exported,
        {   //these are the algorithm options
            name: "RSASSA-PKCS1-v1_5",
            hash: {name: "SHA-1"}, //can be "SHA-1", "SHA-256", "SHA-384", or "SHA-512"
        },
        false, //whether the key is extractable (i.e. can be used in exportKey)
        ["verify"] //"verify" for public key import, "sign" for private key imports
    )
    .then(function(publicKey){
        //returns a publicKey (or privateKey if you are importing a private key)
        cb(undefined,publicKey);
    })
    .catch(function(err){
        cb(err);
    });
}

cryptoWindow.hardCodedVerify=hardCodedVerify;
function hardCodedVerify (_data,signature,cb) {
    hardCodedPublic (function(err,publicKey){
        if (err) return cb(err);
        var win=cryptoWindow(false),subtle=win.crypto.subtle,keyStorage=win.keyStorage,
        data = typeof _data ==='string'? Buffer.from(_data,"utf-8") : _data;
        subtle.verify(
            {
                name: "RSASSA-PKCS1-v1_5",
            },
            publicKey, //from generateKey or importKey above
            signature, //ArrayBuffer of the signature
            data //ArrayBuffer of the data
        )
        .then(function(isvalid){
            //returns a boolean on whether the signature is true or not
            cb(undefined,isvalid,data,_data);
        })
        .catch(cb);
    });
}

cryptoWindow.generateKeys=generateKeys;
function generateKeys(cb){
    var win=cryptoWindow(),subtle=win.crypto.subtle,keyStorage=win.keyStorage;

    // generating RSA key
    subtle.generateKey({
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 1024,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: {
          name: "SHA-1"
        }
      },
        false,
        ["sign", "verify"]
      )
      .then(function(keyPairs){
        /**
         * saving private RSA key to KeyStorage
         * creates file ./key_storage/prvRSA-1024.json
         */
        keyStorage.setItem("uploads-private", keyPairs.privateKey);
        keyStorage.setItem("uploads-public", keyPairs.publicKey);

        subtle.exportKey(
            "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
            keyPairs.publicKey //can be a publicKey or privateKey, as long as extractable was true
        )
        .then(function(keydata){
            //returns the exported key data
            cb(undefined,keyPairs,keydata);
        })
        .catch(cb);
      });
}

cryptoWindow.getPrivate=getPrivate;
function getPrivate (cb) {
    var win=cryptoWindow(),subtle=win.crypto.subtle,keyStorage=win.keyStorage;

    cb(keyStorage.getItem("uploads-private"));
}

cryptoWindow.getPublic=getPublic;
function getPublic (cb) {
    var win=cryptoWindow(),subtle=win.crypto.subtle,keyStorage=win.keyStorage;
    cb(keyStorage.getItem("uploads-public"));
}

cryptoWindow.exportPublic=exportPublic;
function exportPublic (cb) {
    var win=cryptoWindow(),subtle=win.crypto.subtle,keyStorage=win.keyStorage;
    subtle.exportKey(
        "jwk", //can be "jwk" (public or private), "spki" (public only), or "pkcs8" (private only)
        keyStorage.getItem("uploads-public") //can be a publicKey or privateKey, as long as extractable was true
    )
    .then(function(keydata){
        //returns the exported key data
        cb(undefined,keydata);
    })
    .catch(cb);
}

cryptoWindow.sign=sign;
function sign(_data,cb) {
    var win=cryptoWindow(),subtle=win.crypto.subtle,keyStorage=win.keyStorage,
    data = typeof _data ==='string'? Buffer.from(_data,"utf-8") : _data;
    subtle.sign(
        {
            name: "RSASSA-PKCS1-v1_5",
        },
        keyStorage.getItem("uploads-private"), //from generateKey or importKey above
        data //ArrayBuffer of data you want to sign
    )
    .then(function(signature){
        //returns an ArrayBuffer containing the signature
        cb(undefined,new Uint8Array(signature),data,_data);
    })
    .catch(cb);
}

cryptoWindow.verify=verify;
function verify(_data,signature,cb) {
    var win=cryptoWindow(),subtle=win.crypto.subtle,keyStorage=win.keyStorage,
    data = typeof _data ==='string'? Buffer.from(_data,"utf-8") : _data;
    subtle.verify(
        {
            name: "RSASSA-PKCS1-v1_5",
        },
        keyStorage.getItem("uploads-public"), //from generateKey or importKey above
        signature, //ArrayBuffer of the signature
        data //ArrayBuffer of the data
    )
    .then(function(isvalid){
        //returns a boolean on whether the signature is true or not
        cb(undefined,isvalid,data,_data);
    })
    .catch(cb);
}

if (node) {
   module.exports = cryptoWindow;
} else {
    window.cryptoWindow = cryptoWindow;
}

//generateKeys(console.log.bind(console,"generateKeys:"));
//getPrivate (console.log.bind(console,"getPrivate:"));
//getPublic (console.log.bind(console,"getPublic:"));
//exportPublic (console.log.bind(console,"exportPublic:"));
//hardCodedPublic (console.log.bind(console,"hardCodedPublic:"));
/*
sign("hello world",function(err,signature,data,orig_data){
    if (err) throw(err);
    hardCodedVerify(orig_data,signature,console.log.bind(console,"hardCodedVerify:"))
});
*/
})(typeof process==='object' && typeof module==='object' );
