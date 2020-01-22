console.log(global);
console.log('this===global',this===global);
console.log('exports===global',exports===global);
console.log('module.exports===global',module.exports===global);


(function(isNodeJS){
    /*polyfill wrapper to map window.crypto.subtle --> subtle (even in node.js)*/
    (function(
        exports, // <<< maps to window.stringDiffRegex / module.exports
        sha1     // sha1 hash for integrity checks
        ) {

            // null - both strings are identical
            // returns index of first different char
            // note - this might be past the end a or b
            function findFirstDiffFromStart(a,b) {
                if (a===b) return null;
                var
                i,
                l_a = a.length,
                l_b = b.length,
                limit = l_a<= l_b ? l_a : l_b;

                //a=a.split('');
                //b=b.split('');

                for (i=0;i<limit;i++) {
                    if (a[i]!==b[i]) return i;
                }
                return limit;
            }

            // same as findFirstDiffFromStart but in reverse
            // note: if last char of both strings are different, regardless of either length,
            // return value is 0 (ie not the string length)
            function findFirstDiffFromEnd(a,b) {
                if (a===b) return null;
                var
                i,
                l_a=a.length,
                l_b=b.length,
                limit = (l_a<=l_b) ? l_a : l_b;
                //a=a.split('');
                //b=b.split('');
                l_a--;l_b--;

                for (i=0;i<limit;i++) {
                    if (a[l_a-i]!==b[l_b-i]) return i;
                }
                return limit;
            }

            function apply_diff(a,d,cb) {
                if ( !d || d.length<2) return typeof cb==='function'?cb(a):a;
                var b = a.replace(new RegExp(d[0],'s'),d[1]);
                if (typeof cb!=='function') return b;
                return sha1(b,function(hash) {
                    if (hash===d[2]) {
                        return cb(b,hash);
                    }
                });
            }

            function diff_same_length(a,b,h,l_a,l_b,start,end,retcheck) {
                var i,del;
                if (start===0) {
                    if (end===0) {
                        // pretty much entire string is diff
                        return retcheck(['.*',b,h,"start===0,end===0"]);
                    } else {
                        // end of b matches a
                        i = l_b-end;
                        del=(l_a-end);
                        return retcheck(['.{'+del+'}',b.substr(0,i),h,"start===0,end!==0"]);
                    }
                } else {

                    if (end===0) {
                        // start of b matches a
                        i = (l_b-end)-1;
                        return retcheck(['(?<=.{'+start+'}).*',b.substr(start),h,"start!==0,end===0"]);
                    } else {
                        // start and end of b matches a
                       del = ((l_a-end)-start);
                        return retcheck(['(?<=.{'+start+'}).{'+del+'}',b.substr(start,del),h,"start!==0,end!==0"]);
                    }

                }
            }

            function diff_grow(a,b,h,l_a,l_b,start,end,retcheck) {
                var i,del;

                if (start===0) {
                    if (end===0) {
                        // pretty much entire string is diff
                        return retcheck(['.*',b,h,"diff_grow: start===0,end===0"]);
                    } else {
                        // end of b matches a
                        i = (l_b-end)+(l_b-l_a);
                        del=(l_a-end)+(l_b-l_a);
                        return retcheck(['.{'+del+'}',b.substr(0,i),h,"diff_grow: start===0,end!==0"]);
                    }
                } else {
                    if (end===0) {
                        // start of b matches a
                        return retcheck(['(?<=.{'+start+'}).*',b.substr(start),h,"diff_grow: start!==0,end===0"]);
                    } else {
                        // start and end of b matches a


                        /*
                          |<-------- a_end------->|
                        a |<---start-->|<---del-->|<----end--->|
                          |<-----------l_a-------------------->|

                          |<-----------l_b------------------------------->|
                        b |<---start-->|<--------------ins-->|<----end--->|
                          |<----- b_end--------------------->|


                        {    0123456789012345678901234
                        "a":"one two insert xx three",
                        "b":"one two insert xxx three",
                        "d":["(?<=.{17}).{-2}","","ac11e4ad3c6118cfb9894901adfb0bb7da3bf5da","diff_grow: start!==0,end!==0"],"r":"one two insert xx three"}

                                                876543210
                            "a": "one two insert xx three",
                            "b":"one two insert xxx three",


                        l_a = 23
                        l_b = 24
                        start = 17
                        end   = 8
                        a_end = 23-8 = 15
                        b_end = 24-8 = 16



                        */

                        var a_end = l_a-end;
                        var b_end = l_b-end;

                        del = Math.max(0,a_end - start);
                        var ins = b_end - a_end;

                        return retcheck(['(?<=.{'+start+'}).{'+del+'}',b.substr(start,ins),h,"diff_grow: start!==0,end!==0"]);
                    }
                }
            }

            function diff_shrink(a,b,h,l_a,l_b,start,end,retcheck){
                var i,del;
                if (start===0) {
                    if (end===0) {
                        // pretty much entire string is diff
                        return retcheck(['.*',b,h,"diff_shrink: start===0,end===0"]);
                    } else {
                        // end of b matches a
                        i = (l_b-end);
                        del=(l_a-end);
                        return retcheck(['.{'+del+'}',b.substr(0,i),h,"diff_shrink: start===0,end!==0"]);
                    }
                } else {
                    if (end===0) {
                        // start of b matches a
                        return retcheck(['(?<=.{'+start+'}).*',b.substr(start),h,"diff_shrink: start!==0,end===0"]);
                    } else {
                        // start and end of b matches a


                        /*
                          |<-------- a_end----------->|
                        a |<---start-->|<----del----->|<----end--->|
                          |<-----------l_a------------------------>|

                          |<-----------l_b------------------->|
                        b |<---start-->|<--ins-->|<----end--->|
                          |<----- b_end--------->|


                        */


                        var a_end = l_a-end;
                        var b_end = l_b-end;

                        del     = a_end < start ? 0 :  (a_end - start) - (b_end < start ? (b_end - start) :0);
                        var ins = b_end < start ? 0 : l_b - (start+del+end);

                        return retcheck(['(?<=.{'+start+'}).{'+del+'}',b.substr(start,ins),h,"diff_shrink: start!==0,end!==0"]);


                    }
                }
            }

            function diff(a,b,h) {
                var retcheck=function(d) {
                    var r=apply_diff(a,d);
                    if (r!==b) {
                        console.log("qc check fails:"+JSON.stringify({a:a,b:b,d:d,r:r}));
                        return ['.*',b,h];
                    }
                    //console.log("qc check passes:"+JSON.stringify({a,b,d,r}));
                    return !!d?d.slice(0,3):d;
                };
                if (a===b) {
                    return retcheck(null);
                }
                var
                i,
                del,
                l_a=a.length,
                l_b=b.length,
                start = findFirstDiffFromStart(a,b),
                end   = findFirstDiffFromEnd(a,b);

                if (l_a===l_b) {
                    return diff_same_length(a,b,h,l_a,l_b,start,end,retcheck);
                } else {
                    if (l_a<l_b) {
                        return diff_grow(a,b,h,l_a,l_b,start,end,retcheck);
                    } else {
                        return diff_shrink(a,b,h,l_a,l_b,start,end,retcheck);
                    }
                }
            }

            function diffPump(initialValue,listener,master) {
                var is_master = !!master;
                var self = {};

                var currentValue = typeof initialValue==='string'?initialValue:'';
                var currentHash;

                var events = {
                    change : [],
                    diff   : []
                };

                var getSenders = function (fromPool,eventName) {
                    return fromPool.filter(function(sender){
                        if (typeof sender==='object') {
                            return events.diff.indexOf(sender[eventName])>=0;
                        }

                        return false;
                    });
                };


                var emit= function(ev,args,wrap,who) {
                    var hoi_polloi_args=who?args.concat([who]):args;
                    events[ev].forEach(function(fn){
                        if (typeof wrap==='function') {
                            var use_args = wrap(fn,args);
                            if (use_args) {
                               fn.apply(this,who?use_args.concat([who]):use_args);
                            }
                        } else {
                            fn.apply(this,hoi_polloi_args);
                        }
                    });
                };


                Object.defineProperties (self,{
                    value : {
                        get : function() {
                            return currentValue;
                        },
                        set : function (value) {
                            emit("change",[value,"set"]);

                            sha1(value,function(hash) {
                                emit(
                                    "diff",
                                    [currentValue],
                                    function(fn){
                                    var d = diff(fn.currentValue,value,hash);
                                    fn.currentValue = value;
                                    return [d];
                                },
                                    self.update
                                );
                                currentValue = value;
                            });


                        }
                    },
                    addEventListener : {
                        value : function (e,fn) {
                            if (typeof e==='string'&& typeof events[e] ==='object' &&typeof fn==='function') {
                                if (e==="diff") {
                                    fn.currentValue=currentValue;
                                    sha1(currentValue,function(hash) {
                                        fn(['.*',currentValue,hash],self.update,true);
                                    });
                                }
                                events[e].push(fn);
                            }
                        },
                        enumerable: true

                    },
                    removeEventListener : {
                        value : function (e,fn) {
                            if (typeof e==='string'&& typeof events[e] ==='object' &&typeof fn==='function') {
                                var ix = events[e].indexOf(fn);
                                if (ix<0)return;
                                events[e].splice(ix,1);
                            }
                        },
                        enumerable: true

                    },
                    update : {
                        value : function (d,who,initial) {
                            if (d===null||initial && is_master) return;
                            apply_diff(currentValue,d,function(newValue,newHash){
                                currentValue = newValue;
                                currentHash=newHash;
                                emit("change",[currentValue,"update"]);
                                emit(
                                    "diff",
                                    [currentValue],
                                    function(fn){
                                        if (who===fn) return false;
                                        var d = diff(fn.currentValue,currentValue,currentHash);
                                        fn.currentValue = currentValue;
                                        return [d];
                                    },
                                    self.update
                                );
                            });

                        },
                        enumerable: true
                    },
                    connections : {
                        value : getSenders,
                        enumerable: true
                    }
                });

                if (typeof listener==='function') {
                    listener.currentValue=initialValue;
                    sha1(initialValue,function(hash) {
                        listener(['.*',initialValue,hash],self.update,true);
                    });
                    events.diff.push(listener);
                }

                return self;
            }

            function selftest () {
                    diff("","abc");
                    diff("abc","");
                    diff("abc","abc");
                    diff("abc","Xbc");
                    diff("abc","aXc");
                    diff("abc","abX");
                    diff("abc","XXX");
                    diff("abc","abX");
                    diff("abc","XbX");
                    diff("abc","Xabc");
                    diff("abc","XXXabc");
                    diff("abc","Xbcd");
                    diff("abc","aXcd");
                    diff("abc","abXc");
                    diff("abc","abXXc");
                    diff("abc","aXXXXcd");
                    diff("abc","XXXX");
                    diff("abc","abcX");
                    diff("abcd","bcd");
                    diff("abcd","acd");
                    diff("abcd","abd");
                    diff("abcd","abc");
                    diff("abcd","ad");


                    diff("the quick brown fox jumps over the lazy dog",
                         "the quick brown fox jump over the lazy dog");


                    diff("the quick brown fox jump over the lazy dog",
                         "the quick brown fox jumpe over the lazy dog");

                    diff("the quick brown fox jumpe over the lazy dog",
                         "the quick brown fox jumped over the lazy dog");

                    diff("the quick brown fox jumped over the lazy dog",
                         "the quick brown fox jumped over a lazy dog");

                    diff("the quick brown fox jumped over a lazy dog",
                         "the quick brown fox jumped over the lazy dog");

                    diff("the quick brown fox jumped over the lazy dog",
                         "then the quick brown fox jumped over the lazy dog");

                    diff("then the quick brown fox jumped over the lazy dog",
                         "then the quick brown fox jumped over the lazy dogs");

                    diff("then the quick brown fox jumped over the lazy dogs",
                         "then the quick brown fox jumped over the lazy cat");




                    var file = diffPump("some text in a file",undefined,true);
                    file.addEventListener("change",console.log.bind(console,"file:"));

                    var editor1 = diffPump();
                    editor1.addEventListener("change",console.log.bind(console,"editor1:"));

                    file.addEventListener("diff",editor1.update);
                    editor1.addEventListener("diff",file.update);

                    editor1.value += " stuff";

                    var editor2 = diffPump();
                    editor2.addEventListener("change",console.log.bind(console,"editor2:"));
                    file.addEventListener("diff",editor2.update);
                    editor2.addEventListener("diff",file.update);

                    editor1.value =  "total change";
                    editor2.value += " from editor 2";
                    file.value    =  "reset externally";


                 }

            exports.diffPump = diffPump;

            exports.utils = {
                apply_diff : apply_diff,
                diff       : diff,
                selftest   : selftest,
                sha1       : sha1
            };

            if (isNodeJS) {
         }


    })( /*exports*/        isNodeJS ? module.exports : (window.stringDiffRegex={}),
        /*sha1*/           isNodeJS ? sha1Node ()  : sha1Browser()
    );

        function sha1SubtleBrowser() {
            return function sha1(str,cb) {
                if (typeof cb==='function') return sha1BrowserPromise(str).then(cb);
            };
            function sha1BrowserPromise(str) {
              return window.crypto.subtle.digest(
                  "SHA-1",
                  new TextEncoder("utf-8").encode(str))
                    .then(function (hash) {
                        return hexBrowser(hash);
                    });
            }
            function hexBrowser(buffer) {
                var hexCodes = [];
                var view = new DataView(buffer);
                for (var i = 0; i < view.byteLength; i += 4) {
                  // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
                  var value = view.getUint32(i);
                  // toString(16) will give the hex representation of the number without padding
                  var stringValue = value.toString(16);
                  // We use concatenation and slice for padding
                  var padding = '00000000';
                  var paddedValue = (padding + stringValue).slice(-padding.length);
                  hexCodes.push(paddedValue);
                }
                // Join all the hex strings into one
              return hexCodes.join("");
            }
        }

        function sha1Browser() {

            return typeof window.sha1==='function' ? sha1Wrap : sha1SubtleBrowser();

            function sha1Wrap(str,cb) {
                var hex = window.sha1(str);
                return (typeof cb==='function') ? cb(hex) : hex;
            }

        }

        function sha1Node () {
            var crypto = require('crypto');
            return function sha1 (str,cb) {
                  var shasum = crypto.createHash('sha1');
                  shasum.update(str);
                  var hex = shasum.digest('hex');
                  return typeof cb==='function' ? setImmediate(cb,hex) : hex;
            };
        }

    })(typeof process==='object' && typeof module==='object' );
