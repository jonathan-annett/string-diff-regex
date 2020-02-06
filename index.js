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
                } else {
                    console.log({apply_diff:{got:d[2],expected:hash}});
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
                    var ins = b_end - start;

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
                    
                    if (l_b===start) {
                        return retcheck(['(?<=.{'+start+'}).*','',h,"diff_shrink: start!==0,end!==0,l_b===start"]);
                    }
                    
                    if (l_b===end) {
                        del = l_a-l_b;
                        return retcheck(['(?<=.{0}).{'+del+'}','',h,"diff_shrink: start!==0,end!==0,l_b===end"]);
                    }
                    
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

                    //del     = a_end < start ? (start-a_end)+1  :  (a_end - start) - (b_end < start ? (b_end - start) :0);
                    //var ins = b_end < start ? 0 : l_b - (start+del+end);
                    
                    del =   a_end-start;
                    var ins = b_end-start;

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
               
            var test = {"a":"\nconsole.log(\"this is input 1\");\n\n/*\n\n function(inject){\"filename\";} is a literal file include with no wrapping.\n\n the file content is inserted without pre-parsing, replacing the entire function\n declaration with file content.\n\n*/\n\n\n/*[aaaaaaku]-(injected file:input2.js)-->*/\n\n// \nconsole.log(\"this is input 2\");\n\n/*[aaaaaakp]-(injected file:input4.js)-->*/\n\n\nconsole.log(\"this is input 4\");\n\n//interesting\n/*<--(injected file:input4.js)-[aaaaaakp]*/\n\n/*[aaaaaakt]-(injected file:subdir/input8.js)-->*/\nconsole.log(\"this is input 8\");\n\n/*[aaaaaaks]-(injected file:input9.js)-->*/\n\nconsole.log(\"this is input 9\");\n\n/*[aaaaaakq]-(injected file:input10.js)-->*/\nfunction input10() {\n\n   console.log(\"this is input 10\");\n\n}\n/*<--(injected file:input10.js)-[aaaaaakq]*/\n\n/*[aaaaaakr]-(injected file:input11.js)-->*/\n\nconsole.log(\"this is input 11\");\n/*<--(injected file:input11.js)-[aaaaaakr]*/\n/*<--(injected file:input9.js)-[aaaaaaks]*/\n/*<--(injected file:subdir/input8.js)-[aaaaaakt]*/\n/*<--(injected file:input2.js)-[aaaaaaku]*/\n\n// function(include){\"filename\";} wraps the file  in whatever function declaration you provide, without the first\n// \"include\" argument. other arguments are left intact and can be used to pass globals into the file\n// note that the file being included does not have the function declared at all\n// so the arguments behave as globals if you use the file standalone\n// this means you'd need to delcare globals ( see input7.js for an example)\n\n/*[aaaaaakv]>>> file:input3.js >>>*/\nfunction someFile3 (){\n    \n    console.log(\"this is input 3\");\n}/*<<< file:input3.js <<<[aaaaaakv]*/\n\nvar someFile5 = /*[aaaaaakw]>>> file:input5.js >>>*/\n()=>{\n    // this is \n    console.log(\"this is input 5\");\n}/*<<< file:input5.js <<<[aaaaaakw]*/;\n\nsomeFile3();\nsomeFile5();\n\n// whilst you **can** use arrow functions for an inject, it makes very little sense to do so\n// for code... since by definition, the inject syntax replaces the function declaration\n// entirely with the file content.\n\nvar x = /*[aaaaaakx]-(injected file:input6.js)-->*/\n\n\nconsole.log(\"this is input 6\");\n/*<--(injected file:input6.js)-[aaaaaakx]*/\n\n// however it is the perfect way to preload JSON\n\nx = /*[aaaaaaky]-(injected file:input6a.json)-->*/\n{\n    \"data\":\"hello world\",\n    \"more\": \"data\",\n    \"count\":27\n}\n/*<--(injected file:input6a.json)-[aaaaaaky]*/;\n\n \n/*[aaaaaal2]>>> file:input7.js >>>*/\nfunction someFile7 (some,args){\n    /*{#>aaaaaakz<#}*/\n    \n    console.log(\"This is input 7\",some,args);\n    \n    /*{#>aaaaaal1<#}*/\n    \n    console.log(\"That's all from input 7\");\n    \n    /*{#>aaaaaal0<#}*/\n}/*<<< file:input7.js <<<[aaaaaal2]*/\n\n\nsomeFile7(\"a\",\"b\");\n\n\n/*[aaaaaal3]-(injected file:input12.js)-->*/\nfunction someFile12(even,some,more,args){\n    return {some:some,args:args};\n}\n/*<--(injected file:input12.js)-[aaaaaal3]*/\n\n\nconsole.log(someFile12(\"some\",\"args\"));\n\n\nconsole.log(\"and we are done\");\n\n/*{\"omits.db\":\"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\"}*/","b":"\nconsole.log(\"this is input 1\");\n\n/*\n\n function(inject){\"filename\";} is a literal file include with no wrapping.\n\n the file content is inserted without pre-parsing, replacing the entire function\n declaration with file content.\n\n*/\n\n\n/*[aaaaaal9]-(injected file:input2.js)-->*/\n\nconsole.log(\"this is input 2\");\n\n/*[aaaaaal4]-(injected file:input4.js)-->*/\n\n\nconsole.log(\"this is input 4\");\n\n//interesting\n/*<--(injected file:input4.js)-[aaaaaal4]*/\n\n/*[aaaaaal8]-(injected file:subdir/input8.js)-->*/\nconsole.log(\"this is input 8\");\n\n/*[aaaaaal7]-(injected file:input9.js)-->*/\n\nconsole.log(\"this is input 9\");\n\n/*[aaaaaal5]-(injected file:input10.js)-->*/\nfunction input10() {\n\n   console.log(\"this is input 10\");\n\n}\n/*<--(injected file:input10.js)-[aaaaaal5]*/\n\n/*[aaaaaal6]-(injected file:input11.js)-->*/\n\nconsole.log(\"this is input 11\");\n/*<--(injected file:input11.js)-[aaaaaal6]*/\n/*<--(injected file:input9.js)-[aaaaaal7]*/\n/*<--(injected file:subdir/input8.js)-[aaaaaal8]*/\n/*<--(injected file:input2.js)-[aaaaaal9]*/\n\n// function(include){\"filename\";} wraps the file  in whatever function declaration you provide, without the first\n// \"include\" argument. other arguments are left intact and can be used to pass globals into the file\n// note that the file being included does not have the function declared at all\n// so the arguments behave as globals if you use the file standalone\n// this means you'd need to delcare globals ( see input7.js for an example)\n\n/*[aaaaaala]>>> file:input3.js >>>*/\nfunction someFile3 (){\n    \n    console.log(\"this is input 3\");\n}/*<<< file:input3.js <<<[aaaaaala]*/\n\nvar someFile5 = /*[aaaaaalb]>>> file:input5.js >>>*/\n()=>{\n    // this is \n    console.log(\"this is input 5\");\n}/*<<< file:input5.js <<<[aaaaaalb]*/;\n\nsomeFile3();\nsomeFile5();\n\n// whilst you **can** use arrow functions for an inject, it makes very little sense to do so\n// for code... since by definition, the inject syntax replaces the function declaration\n// entirely with the file content.\n\nvar x = /*[aaaaaalc]-(injected file:input6.js)-->*/\n\n\nconsole.log(\"this is input 6\");\n/*<--(injected file:input6.js)-[aaaaaalc]*/\n\n// however it is the perfect way to preload JSON\n\nx = /*[aaaaaald]-(injected file:input6a.json)-->*/\n{\n    \"data\":\"hello world\",\n    \"more\": \"data\",\n    \"count\":27\n}\n/*<--(injected file:input6a.json)-[aaaaaald]*/;\n\n \n/*[aaaaaalh]>>> file:input7.js >>>*/\nfunction someFile7 (some,args){\n    /*{#>aaaaaale<#}*/\n    \n    console.log(\"This is input 7\",some,args);\n    \n    /*{#>aaaaaalg<#}*/\n    \n    console.log(\"That's all from input 7\");\n    \n    /*{#>aaaaaalf<#}*/\n}/*<<< file:input7.js <<<[aaaaaalh]*/\n\n\nsomeFile7(\"a\",\"b\");\n\n\n/*[aaaaaali]-(injected file:input12.js)-->*/\nfunction someFile12(even,some,more,args){\n    return {some:some,args:args};\n}\n/*<--(injected file:input12.js)-[aaaaaali]*/\n\n\nconsole.log(someFile12(\"some\",\"args\"));\n\n\nconsole.log(\"and we are done\");\n\n/*{\"omits.db\":\"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\"}*/","d":["(?<=.{242}).{5835}","l9]-(injected file:input2.js)-->*/\n\nconsole.log(\"this is input 2\");\n\n/*[aaaaaal4",null,"diff_grow: start!==0,end!==0"],"r":"\nconsole.log(\"this is input 1\");\n\n/*\n\n function(inject){\"filename\";} is a literal file include with no wrapping.\n\n the file content is inserted without pre-parsing, replacing the entire function\n declaration with file content.\n\n*/\n\n\n/*[aaaaaal9]-(injected file:input2.js)-->*/\n\nconsole.log(\"this is input 2\");\n\n/*[aaaaaal4\"}*/"};
            
            diff(test.a,test.b);            
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
