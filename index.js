/*jshint maxerr: 10000 */


(function(/*node>>>*/isNodeJS/*<<<node*/ ){
/*polyfill wrapper to map window.crypto.subtle --> subtle (even in node.js)*/
(function(
    exports, // <<< maps to window.stringDiffRegex / module.exports
    sha1,    // sha1 hash for integrity checks,
    perf_now // performance timing tool
    ) {

        // returns index of first different char
        // null - both strings are identical
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
        
        // async version of findFirstDiffFromStart(a,b)
        function asyncFindFirstDiffFromStart(a,b,cb,steps,delayInt) {
            var 
            tmr,abort=function(){ if (tmr) clearTimeout(tmr); tmr=undefined;};
            delayInt=delayInt||0;
            if (a===b) {
                tmr=setTimeout(cb,delayInt,null);
                return abort;
            }
            steps=steps||512;
            var
            l_a = a.length,
            l_b = b.length,
            limit = l_a<= l_b ? l_a : l_b,

            asyncFor=function(i) {
               tmr=undefined;
               var
               this_limit=i+steps,
               partial=this_limit<limit;
               if (!partial) this_limit=limit;
               
               for (;i<this_limit;i++) {
                   if (a[i]!==b[i]) return cb(i);
               } 
               if (partial) {
                   return (tmr = setTimeout(asyncFor,delayInt,this_limit));
               }
               return cb(limit);

            };
            
            tmr = setTimeout(asyncFor,delayInt,0);
            return abort;
            
        }

        // same as findFirstDiffFromStart but in reverse
        // note: if last char of both strings are different, regardless of either length,
        // return value is 0 (ie not the string length)
        function findFirstDiffFromEnd(a,b,from) {
            if (a===b||from===null) return null;
            from=from||0;
            var
            i,
            l_a=a.length,
            l_b=b.length,
            limit = (l_a<=l_b) ? l_a : l_b;
            //a=a.split('');
            //b=b.split('');
            l_a--;l_b--;
            limit-=from;
            for (i=0;i<limit;i++) {
                if (a[l_a-i]!==b[l_b-i]) return i;
            }
            return limit;
        }
        
        // async version of findFirstDiffFromEnd(a,b,from) 
        function asyncFindFirstDiffFromEnd(a,b,from,cb,steps,delayInt) {
            var 
            tmr,abort=function(){ if (tmr) clearTimeout(tmr); tmr=undefined;};
            delayInt=delayInt||0;
            if (a===b||from===null) {
                tmr=setTimeout(cb,delayInt,null);
                return abort;
            }
            from=from||0;
            steps=steps||512;
            var
            l_a=a.length,
            l_b=b.length,
            limit = (l_a<=l_b) ? l_a : l_b;
            //a=a.split('');
            //b=b.split('');
            l_a--;l_b--;
            limit-=from;
            var
            asyncFor=function(i) {
               tmr=undefined;
               var
               this_limit=i+steps,
               partial=this_limit<limit;
               if (!partial) this_limit=limit;
               
               for (;i<this_limit;i++) {
                   if (a[l_a-i]!==b[l_b-i]) return cb(i);
               }
               
               if (partial) {
                   return (tmr = setTimeout(asyncFor,delayInt,this_limit));
               }
               return cb(limit);

            };
            
            tmr = setTimeout(asyncFor,delayInt,0);
            return abort;
        }

        
        // diff format array [regexSrc, regexArg, *hashB, *hashA, *comments ] *=optional
        // the diff is the "recipe" to get from "a" to "b" assuming you have "a" already
        //  if hashA is provided, it's an extra safety check - don't even bother applying the diff
        // callbacks
        // if cb is supplied, the hash is calculated, then cb is called: cb (b,hash)
        // if no cb is applied, just b is returned (you need to hash yourself to verify the diff)
        // if d is invalid in any way (ie a null, or less than 2 arguments, no change is applied ie b=a)
        function apply_diff(a,patch,curHashA,cb) {
            //curHashA is optional
            if (typeof curHashA==='function') {cb=curHashA;curHashA=undefined}
            
            const cbOk=typeof cb==='function';
            if ( !Array.isArray(patch) || patch.length<2) return cbOk?cb(a):a;
            const [rSrc,rArg,expectHashB,needHashA,comments] = patch;
            const inputsOk=(typeof a+typeof rSrc+typeof rArg==='stringstringstring') && 
                  (
                      (typeof curHashA==='undefined') ||
                      (
                           typeof curHashA==='string'
                           &&
                           curHashA===needHashA
                      )
                 );
            // something about the innput args is fishy, return whatever was passed in as a
            if (!inputsOk) return cbOk?cb(a,undefined,false):a;
            
            // do the edit
            var b = a.replace(new RegExp(rSrc,'s'),rArg);
            
            return !cbOk ? b: sha1(b,function(calcHashB) {
                const passes = (typeof expectHashB==='string')&&(calcHashB===expectHashB);
                if (cb.force||passes||(typeof expectHashB==='undefined')) {
                    return cb(b,calcHashB,passes);
                } else {
                    console.log({apply_diff:{calc:calcHashB,expected:expectHashB}});
                }
            });
        }

        function diff_same_length(a,b,hb,ha,l_a,l_b,start,end,retcheck) {
            var i,del;
            if (start===0) {
                if (end===0) {
                    // pretty much entire string is diff
                    return retcheck(['.*',b,hb,ha,"start===0,end===0"]);
                } else {
                    // end of b matches a
                    i = l_b-end;
                    del=(l_a-end);
                    return retcheck(['.{'+del+'}',b.substr(0,i),hb,ha,"start===0,end!==0"]);
                }
            } else {

                if (end===0) {
                    // start of b matches a
                    i = (l_b-end)-1;
                    return retcheck(['(?<=.{'+start+'}).*',b.substr(start),hb,ha,"start!==0,end===0"]);
                } else {
                    // start and end of b matches a
                   del = ((l_a-end)-start);
                    return retcheck(['(?<=.{'+start+'}).{'+del+'}',b.substr(start,del),hb,ha,"start!==0,end!==0"]);
                }

            }
        }

        function diff_grow(a,b,hb,ha,l_a,l_b,start,end,retcheck) {
            var i,del;

            if (start===0) {
                if (end===0) {
                    // pretty much entire string is diff
                    return retcheck(['.*',b,hb,ha,"diff_grow: start===0,end===0"]);
                } else {
                    // end of b matches a
                    i = (l_b-end)+(l_b-l_a);
                    del=(l_a-end)+(l_b-l_a);
                    return retcheck(['.{'+del+'}',b.substr(0,i),hb,ha,"diff_grow: start===0,end!==0"]);
                }
            } else {
                if (end===0) {
                    // start of b matches a
                    return retcheck(['(?<=.{'+start+'}).*',b.substr(start),hb,ha,"diff_grow: start!==0,end===0"]);
                } else {
                    // start and end of b matches a


                    /*
                      |<-------- a_end------->|
                    a |<---start-->|<---del-->|<----end--->|
                      |<-----------l_a-------------------->|

                      |<-----------l_b------------------------------->|
                    b |<---start-->|<--------------ins-->|<----end--->|
                      |<----- b_end--------------------->|

                    */
                    
                    if (l_a===start) {
                        ins = l_b-l_a;
                        return retcheck(['(?<=.{'+start+'}).{0}',b.substr(start),hb,ha,"diff_grow: start!==0,end!==0,l_a===start"]);
                    }
                    
                    if (l_a===end) {
                        return retcheck(['(?<=.{0}).{0}',b.substr(0-end),hb,ha,"diff_grow: start!==0,end!==0,l_a===end"]);
                    }

                    del     = l_a-(start+end) ;
                    var ins = l_b-(start+end) ;
                    
                    if (del<0) {
                        start += del;
                        ins   -= del;
                        del    = 0;
                    }
                    return retcheck(['(?<=.{'+start+'}).{'+del+'}',b.substr(start,ins),hb,ha,"diff_grow: start!==0,end!==0"]);
                }
            }
        }

        function diff_shrink(a,b,hb,ha,l_a,l_b,start,end,retcheck){
            var i,del;
            if (start===0) {
                if (end===0) {
                    // pretty much entire string is diff
                    return retcheck(['.*',b,hb,ha,"diff_shrink: start===0,end===0"]);
                } else {
                    // end of b matches a
                    i = (l_b-end);
                    del=(l_a-end);
                    return retcheck(['.{'+del+'}',b.substr(0,i),hb,ha,"diff_shrink: start===0,end!==0"]);
                }
            } else {
                if (end===0) {
                    // start of b matches a
                    return retcheck(['(?<=.{'+start+'}).*',b.substr(start),hb,ha,"diff_shrink: start!==0,end===0"]);
                } else {
                    
                    if (l_b===start) {
                        return retcheck(['(?<=.{'+start+'}).*','',hb,ha,"diff_shrink: start!==0,end!==0,l_b===start"]);
                    }
                    
                    if (l_b===end) {
                        del = l_a-l_b;
                        return retcheck(['(?<=.{0}).{'+del+'}','',hb,ha,"diff_shrink: start!==0,end!==0,l_b===end"]);
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
                    
                    del     = l_a-(start+end) ;
                    var ins = l_b-(start+end) ;
                    
                    var txt = ins < 0 ? '' : b.substr(start,ins);
                    if (ins < 0) {
                        del -= ins;
                    }

                    return retcheck(['(?<=.{'+start+'}).{'+del+'}',txt,hb,ha,"diff_shrink: start!==0,end!==0"]);


                }
            }
        }


        // inputs: diff (a,b,hb,*ha)   *= optional
        // a = old value, b= current value (ie calculate diff from a to b)
        // hb = hash of b (new value)
        // ha = hash of a (current value)
        
        function diff(a,b,hb,ha) {
            var retcheck=function(d) {
                var r=apply_diff(a,d);
                if (r!==b) {
                    console.log("qc check fails:"+JSON.stringify({a:a,b:b,d:d,r:r}));
                    return ['.*',b,hb,ha];
                }
                //console.log("qc check passes:"+JSON.stringify({a,b,d,r}));
                return !!d?d.slice(0,typeof ha==='string'?4:3):d;
            };
            if (a===b) {
                return retcheck(null);
            }
            var
            l_a=a.length,
            l_b=b.length,
            start = findFirstDiffFromStart(a,b),
            end   = findFirstDiffFromEnd(a,b,start);

            if (l_a===l_b) {
                return diff_same_length(a,b,hb,ha,l_a,l_b,start,end,retcheck);
            } else {
                if (l_a<l_b) {
                    return diff_grow(a,b,hb,ha,l_a,l_b,start,end,retcheck);
                } else {
                    return diff_shrink(a,b,hb,ha,l_a,l_b,start,end,retcheck);
                }
            }
        }
        
        
        // inputs: diff (a,b,hb,*ha,cb)   *= optional
        // a = old value, b= current value (ie calculate diff from a to b)
        // hb = hash of b (new value)
        // ha = hash of a (current value)
        function asyncDiff(a,b,hb,ha,cb) {
            
            // ha is optional; swizzle it for the callback
            if (typeof ha === 'function') { cb=ha;  ha=undefined; }
            if (typeof cb!=='function') { throw new Error ('expecting callback');}
            if (typeof a+typeof b+typeof hb!=='stringstringstring') {
                throw new Error("expecting strings as input");
            }
            if ("stringundefined".indexOf(typeof ha)<0) { throw new Error("ha is not a string");}
            
            var retcheck=function(d) {
                var diff_check=function(r,hash){
                    if (r!==b) {
                        console.log("qc check fails:"+JSON.stringify({a:a,b:b,d:d,r:r}));
                        return cb(['.*',b,hb,ha]);
                    }
                    //console.log("qc check passes:"+JSON.stringify({a,b,d,r}));
                    return cb(!!d?d.slice(0,3):d);                   
                };
                diff_check.force=true;
                return apply_diff(a,d,diff_check);
            };
            if (a===b) {
                return retcheck(null);
            }
            var
            l_a=a.length,
            l_b=b.length,
            steps=Math.min(l_a+l_b,2048),// ie upto 2kb don't use steps
            delayInt=l_a+l_b<4096?0:50;
            
            asyncFindFirstDiffFromStart(a,b,function(start){
                asyncFindFirstDiffFromEnd(a,b,start,function(end){
                    if (l_a===l_b) {
                        return diff_same_length(a,b,hb,ha,l_a,l_b,start,end,retcheck);
                    } else {
                        if (l_a<l_b) {
                            return diff_grow(a,b,hb,ha,l_a,l_b,start,end,retcheck);
                        } else {
                            return diff_shrink(a,b,hb,ha,l_a,l_b,start,end,retcheck);
                        }
                    }
                },steps,delayInt);
            },steps,delayInt);
            
           
            
        }
        

        exports.utils = {
            apply_diff : apply_diff,
            diff       : diff,
            sha1       : sha1,
            asyncDiff  : asyncDiff,
            perf_now   : perf_now(100)
        };

/*node>>>*/
        if (isNodeJS) {
            (function(){            
                        const fs = require('fs');
                        var pathlib = require("path");
                        var urllib = require("url");
                        var mime = require("mime");
                        
                        const cleanup = new RegExp('\\/\\*node\\>\\>\\>\\*\\/(.*?)\\/\\*\\<\\<\\<node\\*\\/','sg');
                        exports.selfServeHandler = function(req,res){
                            const sendSelf= function(){
                                res.setHeader('content-type',  'application/javascript');
                                res.setHeader('content-length', exports.browser_src_len);
                                res.setHeader('etag',           exports.browser_src_etag);
                                res.statusCode = 200;
                                res.end(exports.browser_src);                    
                            }
                            if (Buffer.isBuffer(exports.browser_src)&&exports.browser_src_len&&exports.browser_src_etag) {
                                if (typeof exports.browser_src_etag==='string'&&req.headers['if-none-match']===exports.browser_src_etag){
                                    res.setHeader('etag',exports.browser_src_etag);
                                    res.statusCode = 304;
                                    return res.end('Not Modified');
                                }
                                return sendSelf();
                            } else {
                                fs.readFile(__filename,'utf8',function(err,data){
                                    if (err) {
                                        res.type('text');
                                        res.status(500).send('Internal Error:'+err.message||err.toString());
                                    }
                                    exports.browser_src = Buffer.from(data.replace(cleanup,''));
                                    exports.browser_src_len = exports.browser_src.length.toString();
                                    return sendSelf();
                                });
                            } 
                           
                        };
                        exports.diffRequestHandler = diffRequestHandler;
                        
                         exports.express = function(app,express,route) {
                            if (typeof app==='function'&& 
                                 app.constructor.name+
                                 typeof app.get+
                                 typeof app.post+
                                 typeof app.cache==='EventEmitterfunctionfunctionobject') {
                                     
                               app.get(route||'/'+pathlib.basename(__filename),exports.selfServeHandler);
                            }  
                         };  
                        //var test = {"a":"console.log(\"this is input 2\");\n\nfunction someFile4(inject){\"input4.js\";}\n\nfunction someFile8(inject){\"subdir/input8.js\";}\n","b":"console.log(\"this is input 2\");\nfunction someFile8(inject){\"subdir/input8.js\";}\n","d":["(?<=.{32}).{42}","","7631667a6026fae23294b9a0a762d2d8cd4254e2","diff_shrink: start!==0,end!==0"],"r":"console.log(\"this is input 2\");\n\nfunction someFile8(inject){\"subdir/input8.js\";}\n"};
            
            
                 
                   
                 function bufferPatchRequest(req, res, callback) {
                     var buffers = [],
                         bytes=0,
                         wipe = function(){buffers.splice(0,buffers.length);},
                         getPatch = function(){ 
                             const res = Buffer.concat(buffers).toString('utf8');
                             wipe();
                             return res; 
                             
                         };
                     req.on("data", function(data) {
                         buffers.push(data);
                         bytes+=data.length;
                         if (bytes > 1e6) {
                             wipe();
                             res.writeHead(413, {
                                 "Content-Type": "text/plain"
                             });
                             req.connection.destroy();
                         }
                     });
                     req.on("end", function() {
                         const patch = getPatch();
                         console.log(patch);
                         req.patch = JSON.parse(patch);
                         callback();
                     });
                 }
                 
                 function make_path_for_sync(filename,mkdir) {
                     
                     if (typeof filename!=='string' || filename==='/' || !filename.startsWith('/')) throw new Error("can't create path");
                     
                     const dirname = path.dirname(filename);
                     
                     const stat = fs.existsSync(filename)?fs.statSync(filename):undefined;
            
                        if (!stat) {
                            
                             make_path_for_sync(dirname,true);
                            
                            if (mkdir) {
                                    fs.mkdirSync(filename);
                            } else {
                                // only gers invoked in outer loop - ie file/dir did not exist
                               return {dirname:dirname,exists:false,isDir:false};
                            }
                            
                        } else {
                            
                            if (!mkdir) {
                                // oonly gets invoked in outer loop - ie path exists and if it is a directory
                                return {dirname,exists:true,isDir:stat.isDirectory()};
                            }
                        }
                            
                     
                 }
            
                 function fs_writeFileSync(filename,data){ 
                        
                        if (typeof filename==='string') {
                            if (typeof data==='string'||Buffer.isBuffer(data)) {
                                
                                const results = make_path_for_sync(filename);
                                if (results.isdir) {
                                    throw (new Error(filename+" exists and is a directory"));
                                }
                                
                                return fs.writeFileSync(filename,data);
                            
                            }
                        } 
                        
                        throw new Error ('incorrect argument types');
                        
                    }
            
                 
                 function make_path_for(filename,cb,mkdir) {
                     
                     if (typeof filename!=='string' || filename==='/' || !filename.startsWith('/')) return cb(new Error("can't create path"));
                     
                     const dirname = path.dirname(filename);
                     fs.stat(filename,function(err,stat){
                        
                        
                        if (!stat) {
                            make_path_for(dirname,function(err){
                                if (err) return cb (err);
                                if (mkdir) {
                                    fs.mkdir(filename,cb);
                                } else {
                                    // only gers invoked in outer loop - ie file/dir did not exist
                                   return cb (undefined,dirname,false,false);
                                }
                            },true);
                        } else {
                            if (!mkdir) {
                                // oonly gets invoked in outer loop - ie path exists and if it is a directory
                                return cb (undefined,dirname,true,stat.isDirectory())  
                            } else {
                                cb();
                            }
                        }
                            
                     });
                 }
               
                  function fs_statSync(filename,stat,realpath) {
                     
                    if (!stat) stat = fs.statSync(filename);
                    stat.realpath = realpath || fs.realpathSync(filename);
                    stat.path = path.resolve(filename);
                    stat.basename = path.basename(stat.path);
                    stat.realbasename = path.basename(stat.realpath);
                    stat.id_hash = crypto.createHash("sha1").update(filename).digest("hex");
                    stat.isSymbolicLink = function() {
                        return (stat.path!==stat.realpath);
                    };
                    return stat;
                 }
                 
                 
                 function fs_stat(filename,cb){
                     fs.stat(filename,function(err,stat){
                        if (err) return cb(err);
                        fs.realpath(filename,function(err,realpath){
                         cb(undefined,fs_statSync(filename,stat,realpath));    
                        });
                     });
                 }
                 
                 function getFileVersion (filename,cb) {
                     
                     
                     switch (typeof filename+typeof cb) {
                         case 'stringfunction' : fs_stat(filename,function(err,stat){
                             if (err) return cb(err);
                             if (stat.isSymbolicLink()) {
                                 return cb (err,stat.realbasename.split('.')[0]);
                             } else {
            
                             }
                         });
                     }
                     
                     
                 }
                 
                   
                 // 1 - won't change file it currently has same data
                 // 2 - returns current contents as buffer
                 // 3 - if differnt, return sha1 hash of each
                 // 4 - you can optionally supply hash for current data, to save rehashing
                 // 5 - if swap is true: if destfile exists, on return, transit file
                 //     will contain the previous contents of destfile, and  destfile will contain the passed in data
                 //     if transsit file existed it's contents are returned to caller
                 //     (also if tranist happens to already have the data being written, it will just be renamed to overwite 
                 //     destfile, then it will be resaved with the original contents of destfile, assuming it existed)
                 function atmomicReplace (
                     destFilename,    /* this is the file we are writing "data"" to */
                     transitFilename, /* this is the file that's used to do the atomic write/swap */
                     data,            /* this is the data being written to destFilename */
                     hash,            /* this is the hash of the data being written (optional, will hash it if not supplied )*/
                     swap,            /* forces transitFilename to persist after the operation, and it will contain whatever 
                                         was in destfile before the process began (eg good for a backup file)*/
                     cb ) {/* (err, hash, hash_of_replaced, replaced, transithash, transitdata ) */
                     
                     
                     if (typeof swap==='function') {
                         cb=swap;
                         swap=false;
                     }
                     
                     if (typeof hash==='function') {
                         cb=hash;
                         hash=undefined;
                         swap=false;
                     }
                     const source = Buffer.isBuffer(data) ? data : Buffer.from(data);
                     
                     if (typeof hash!=='string') {
                         hash = crypto.createHash("sha1").update(source).digest("hex");
                     }
                     
                   
                     
                     const phase_2 = function (transit_data,transit_hash){
                     
                         fs.readFile(destFilename,function(err,current_data,stat){
                             
                            
                             if (!err && current_data) {
                                 
                                 
                                 if (Buffer.compare(source,current_data)===0) {
                                     
                                     if(swap) {
                                         
                                         if ( transit_hash===hash ) {
                                         
                                             return cb (
                                                 undefined,
                                                 hash,
                                                 hash,
                                                 current_data,
                                                 transit_hash,
                                                 transit_data);        
                                         }
                                         
                                         fs_writeFile(transitFilename,current_data,function(err){
                                             if (err) return cb(err);
                                             return cb(
                                                 undefined,
                                                 hash,
                                                 crypto.createHash("sha1").update(current_data).digest("hex"),
                                                 current_data,
                                                 transit_hash,
                                                 transit_data );
                                          });
                                         
                                          
                      
                                         
                                     } else {
                                         
                                       return cb (
                                           undefined,
                                           hash,
                                           hash,
                                           current_data,
                                           transit_hash,
                                           transit_data );
                                           
                                     }
                                 }
                                 
                                 if (transit_hash===hash) {
                                     
                                     fs.rename(transitFilename,destFilename,function(){
                                     if (err) return cb(err);
                                     
                                         if (swap) {
                                             
                                        fs_writeFile(transitFilename,current_data,function(err){
                                             if (err) return cb(err);
                                            return cb(
                                            undefined,
                                            hash,
                                            crypto.createHash("sha1").update(current_data).digest("hex"),
                                            current_data,
                                            transit_data,
                                            transit_hash);
                                            
                                         
                                         
                                             }); 
                                                 
                                         } else {
                                             return cb(
                                                 undefined,
                                                 hash,
                                                 crypto.createHash("sha1").update(current_data).digest("hex"),
                                                 current_data);
                                                 
                                         }
                                     });
                                 } else {
                                     
                               
                                     fs_writeFile(transitFilename,source,function(err){
                                         if (err) return cb(err);
                                         fs.rename(transitFilename,destFilename,function(){
                                             if (err) return cb(err);
                                             if (swap) {
                                                 fs_writeFile(transitFilename,current_data,function(err){
                                                     if (err) return cb(err);
                                                 return cb(
                                                     undefined,
                                                     hash,
                                                     crypto.createHash("sha1").update(current_data).digest("hex"),
                                                     current_data,
                                                     transit_hash,
                                                     transit_data
                                                  );
                                                 });
                                            } else {
                                                 return cb(
                                                     undefined,
                                                     hash,
                                                     crypto.createHash("sha1").update(current_data).digest("hex"),
                                                     current_data
                                                 );                                   
                                                
                                            }
                                         });
                                     });
                                  }
                                 
                             } else {
                                 
                                 if (transit_hash===hash) {
                                     
                                     fs.rename(transitFilename,destFilename,function(err){
                                         if (err) return cb(err);
                                         if (swap) {
                                             fs_writeFile(transitFilename,transit_data,function(err){
                                                 if (err) return cb(err);
                                                 return cb(undefined,hash,undefined,undefined,transit_data,transit_hash) 
                                             });
                                         } else {
                                            return cb(undefined,hash)
                                         }
                                     });
                                     
                                 } else {
                                     
                                     fs_writeFile(transitFilename,source,function(err){
                                         if (err) return cb(err);
                                         fs.rename(transitFilename,destFilename,function(err){
                                             if (err) return cb(err);
                                             
                                                 fs_writeFile(transitFilename,transit_data,function(err){
                                                     if (err) return cb(err);
                                                     return cb(undefined,hash,undefined,undefined,transit_data,transit_hash) 
                                                 });
                                            
                                         });
                                     });
                                 
                                 }
                                 
                             }
                             
                         });
                     
                     }
                     
                     if (swap) {
                         fs.readFile(transitFilename,function(err,data){
                             // if no previous transit data, just, proceed without it 
                             if (err) return phase_2();
                             phase_2(data,crypto.createHash("sha1").update(data).digest("hex"));
                         });
                     } else {
                         
                         phase_2();
                     }
                     
                 }
                 
                 
                 function fs_writeFileSha1(filename,patch,data,cb){
                     
                     /*
                     
                     filename.js (the live version of the file)
                     ├── .filename.js  (hidden directory)
                     │   ├── current.js ( symlink to last saved version) 
                     │   ├── 5a216ce660a2ef399129770658c1125ec0d4248b-db6e81b7ccc9358559649c60bc80ee994c88dd17.json
                     │   ├── db6e81b7ccc9358559649c60bc80ee994c88dd17.js
                     │   └── 5a216ce660a2ef399129770658c1125ec0d4248b.js
                     └── ...
                     
                     
                     */
                     
                     const ext = filename.substr(filename.lastIndxOf("."));
                     const basename     = path.basename(filename);
                     const dirname      = path.dirname(filename)
                     const file_hash    = crypto.createHash("sha1").update(data).digest("hex");
                     const prior_hash   = patch[3]; 
                     const full_replace = patch[0]==='*.';
                     if (!full_replace && file_hash!==patch[2]) {
                         return cb(new Error("patch supplied does not match data"));
                     }
                     const current_version_link = path.join(dirname,"."+basename+'/current'+ext);
                     const current_version_path = path.join(dirname,"."+basename+'/'+file_hash+ext);
                     const current_patch_path   = path.join(dirname,"."+basename+'/'+prior_hash+'-'+file_hash+".json");
                     
                     var file_stat;
                     const create_current_link = function () {
                         fs.unlink(current_version_link,function(){
                            fs.symlink(current_version_path,current_version_link,function(err){
                                if(err) return cb(err);
                                cb(undefined,file_hash);
                            });
                         });
                     }
                           
                     fs_writeFile(full_replace?false:current_patch_path,full_replace?'':JSON.stringify(patch),function(err){
                         if (err && !full_replace) return cb(err);
                               
                           atmomicReplace (
                             filename,             /* this is the file we are writing "data"" to */
                             current_version_path, /* this is the file that's used to do the atomic write/swap */
                             data,                 /* this is the data being written to destFilename */
                             hash,                 /* this is the hash of the data being written (optional, will hash it if not supplied )*/
                             true,                 /* forces transitFilename to persist after the operation, and it will contain whatever 
                                                 was in destfile before the process began (eg good for a backup file)*/
                             function (err, hash, hash_of_replaced, replaced, transithash, transitdata ) {
                                 
                                 if (err) return cb(err);
                                 
                                 if (transithash !==hash) {
                                     
                                     fs_writeFile(
                                         current_version_path,
                                         data,
                                         function(err){
                                         if (err) return cb(err);
                                          
                                         if (transithash) {
                                             
                                             const transit_version_path   = path.join(dirname,"."+basename+'/'+transithash+ext);
                                             
                                             fs.stat(transit_version_path,function(err,stat){
                                                 if (err) {
                                                     fs_writeFile(transit_version_path,transitdata,function(err){
                                                         if (err) return cb(err);
                                                         return  create_current_link();  
                                                     });
                                                 } else {
                                                    return  create_current_link();  
                                                 }
                                             });
                              
                                          } else {
                                           return  create_current_link();  
                                         }
                                         
                                     });
                                     
                                 } else {
                                     // if hashes match, both files contain current data, so we are done.
                                   return  create_current_link();  
                                 }
                            });
                         
                           
                     });
                     
                 
                     
                 }
                 
                 
               fs_fileObjSync.keys=['size','atimeMs','mtimeMs','ctimeMs']; 
            
               function fs_fileObjSync(filename,data,file,stat){
                    if (stat) {
                        for(var i = 0; i < fs_fileObjSync.length; i++) {
                            var k = fs_fileObjSync[i];
                            file[k]=stat[k];
                        }
                    }
                     if (file.data!==data){
                         file.sha1=crypto.createHash("sha1").update(data).digest("hex");
                         file.data=data;
                     }
                     const contentType = mime.lookup(filename);
                     file.headers = { 
                         200 : {
                             'content-type' : contentType,
                             'content-length':file.data.length,
                             'etag': file.sha1
                         },
                         304 : {
                             'content-type': contentType,
                             'content-length': 0 ,
                             'etag': file.sha1
                         }
                     };
                     delete file.isDirectory;
                     delete file.isFile;
                     delete file.isSymbolicLink;
                     
                     return file; 
               }
               
               function fs_fileObj(filename,data,file,cb){
                   cb(fs_fileObjSync(filename,data,file));
               }
               
               
               function fs_dirObjListing(dirname, dir,list) {
            
                    dir.data = Buffer.from(list.join('\n'));
                    dir.sha1=crypto.createHash("sha1").update(dir.data).digest("hex"); 
                    dir.headers = { 
                        200 : {
                            'content-type': 'text/plain',
                            'content-length':dir.data.length,
                            'etag': dir.sha1
                        },
                        304 : {
                            'content-type': 'text/plain',
                            'content-length': 0 ,
                            'etag': dir.sha1
                        }
                    };
                 delete dir.isDirectory;
                 delete dir.isFile;
                 delete dir.isSymbolicLink;       
                 return dir;
               }
               
               function fs_dirObjSync(dirname, dir) {
                   const list = fs.readdirSync(dirname);
                   dir.listing = list.slice();
                   for (let i = 0; i < list.length; i++) {
                     if (i<list.length) {
                         stat = fs.statSync(filePath + "/" + list[i]);
                         if (stat.idisDirectory()){
                             list[i]+='/';
                             getDirs(i+1);
                          }
                     } else {
                       
                     }
                   }
                   return fs_dirObjListing(dirname, dir,list);
             }
               
                function fs_dirObj(filename,data,dir,cb){
                   fs.readdir(filename, function(err, list) {
                       dir.listing = list.slice();
                         const getDirs = function (i) {
                           if (i<list.length) {
                                fs.stat(filePath + "/" + list[i],function(err,stat){
                                    if (stat.idisDirectory());
                                      list[i]+='/';
                                      getDirs(i+1);
                                });
                           } else {
                               return cb(undefined,fs_dirObjListing(dirname, dir,list));
                           }
                       };
                       getDirs(0);
                   });
                }
                
                 function fs_readFileSha1(filename,cb){
                     
                     fs_stat(filename,function(err,file){
                        if (err) return cb(err);
                        if (file.isDirectory()) {
                            fs_dirObj(filename,file,cb)
                        } else {
                            fs.readFile(filename,function(err,data){
                               if (err) return cb(err);
                               cb (undefined,fs_fileObjSync(filename,data,file));
                            });
                        }
                     });
            
                 }
                 
                 
                 function error(res, code, message) {
                     res.writeHead(code, {
                         "Content-Type": "text/plain"
                     });
                     res.write(code + " " + message);
                     res.end();
                 }
                 
                const hours = 2,msecPerHour=60 * 60 * 1000;
                
                function cleanStaleCache() {
                    var cache = cleanStaleCache.cache;
                    var now  = Date.now(),threshhold = now - ( hours * msecPerHour);
                    if (cleanStaleCache.nextTick) {
                        if (now<cleanStaleCache.nextTick)  {
                            return;
                        }
                    }
                    cleanStaleCache.nextTick = now + 30 * 1000;
                    Object.keys(cache).forEach(function(id_hash){
                       const file = cache[id_hash];
                       if (file.touched) {
                           if (file.touched<threshhold) {
                               ['data','sha1','headers'].forEach(function(k){  delete file[k];  });
                               delete file.data;
                               delete cache[id_hash];
                           }
                       } else {
                           file.touched = now;
                       }
                    });
                }         
                     
                function diffPatchRequestHandler(req,res,filepath,id_hash,cache) {
                    
                    // setup fake server environment : a file called a.text containing "hellow world"
          
                    return bufferPatchRequest(req,res,function(){
                       
                        procesPatch(req.patch);
                        
                    });
                    
                    
                    
                    
                    function ifIsValidPatch(patch,cb) {
                        
                        if (Array.isArray(patch) && 
                               patch.length > 2 && patch.length < 5 && 
                               patch.reduce(function(ok,str,index){ 
                                   return ok && 
                                       typeof str === 'string' &&
                                       (index < 2 || str.length===40);
                                   
                               },true)) {
                                   if (cb) cb();
                                   return true;
                               }
                               
                        return false;
                    }
                    
                    function ifNotOverwriting(patch,cb){
                        // if overwriting, deal with it, otherwise cal the callback
            
                        const [ regExSrc, overwrite_data, overwrite_hash ] =  patch;
                        
                        
                        // small cheat here = '.*' is a global replace = overwrite.
                        // it's also the code sent when file needs to be created or replaced
                        if ( regExSrc !== '.*' ) {
                            if (cb) cb();
                            return  true;
                        }
                        
                        // trust, but verify: check that the hash matches 
                        sha1(overwrite_data,function(hash){
                            if (overwrite_hash===hash) {
                                fs.writeFile(filepath,overwrite_data,function(err){
                                    const file = cache[id_hash];
                                    if (file) {
                                        file.data=overwrite_data;
                                        file.hash=overwrite_hash
                                    } else{
                                        cache[id_hash] = {
                                            data:overwrite_data,
                                            hash:overwrite_hash
                                        };
                                    }
                                    // send new_hash to browser as confirmation
                                    res.send(JSON.stringify({
                                        saved:patch.slice(2).join('-'),
                                        current:overwrite_hash
                                    }));
                                    
                                });
                            } else {
                                // send new_hash to browser as confirmation
                                if (cache[id_hash]){
                                    res.send(JSON.stringify({
                                        error:"corrupt patch",
                                        current:cache[id_hash].hash
                                    }));
                                    
                                } else {
                                    fs.readFile(filepath,'utf8',function(err){
                                        if (err) {
                                            res.send(JSON.stringify({
                                                error:"corrupt patch",
                                                current:null
                                            }));
                                        
                                        } else {
                                            sha1(server_data,function(server_hash){
                                                cache[id_hash] = {
                                                    data:server_data,
                                                    hash:server_hash
                                                };
                                                res.send(JSON.stringify({
                                                    error:"corrupt patch",
                                                    current:cache[id_hash].hash
                                                }));
                                            });
                                        }
                                    });
                                }
                            }
                        });    
                        
                        return false;
                    }
                    
                    
                    function procesPatch(patch) {
                        
                        ifIsValidPatch(patch,function() { 
                            
            
                            ifNotOverwriting(function(){
                            
                           
                                     
                                     const apply_patch = function(server_a,patch,server_ha) {
                                         
                                          apply_diff (server_a,patch,server_ha,function(new_a,new_hash,passes){
                                              
                                              if (passes) {
                                                  
                                                  fs.writeFile(filepath,new_a,function(err){
                                                      
                                                      // send new_hash to browser as confirmation
                                                      res.send(JSON.stringify({
                                                          saved:patch.slice(2),
                                                          current:new_hash
                                                      }));
                                                      
                                                  });
                                                  
                                              } else {
                                                  
                                                  // send failure to b
                                                  // send new_hash to browser as confirmation
                                                  res.send(JSON.stringify({
                                                      failed:patch.slice(2),
                                                      current:server_ha
                                                  }));
                                              }
                                              
                                          });
                                          
                                     };
                                     
                                     if (cache[id_hash] && cache[id_hash].hash===patch[3]) {
                                          // the cached hash matches, so memory copy is good
                                          apply_patch (cache[id_hash].data,patch,cache[id_hash].hash);
                                     } else {
                                         // either file is not cached or server is out of sync - see if the disk version 
                                         // matches
                                         fs_readFileSha1(filepath, function(err, file) {
                                              if (err) {
                                                 return res.send(JSON.stringify({
                                                     error:err.message||err.toString(),
                                                     current:cache[id_hash] ? cache[id_hash].hash:null
                                                 }));
                                              }
                                              apply_patch((cache[id_hash]=file).data,file.hash);
                                         });
                                     }
                                     
                             });
                            
                            
                        });
                        
                        
                    }
            
    
                    
                    
                }
                
                const header_keys=['content-type','content-length','etag'];
                function diffGetRequestHandler(req,res,filepath,id_hash,cache) {
                    
                    const send_file = function (file) {
                        let code = req.headers['if-none-match']===file.sha1 ? 304 : 200;
                        res.statusCode = code;
                        header_keys.forEach(function(k){
                            res.setHeader(k, file.headers[code][k]);
                        });
                        if (code === 200) {
                           res.send(file.data);
                        } else {
                           res.end("Not Modified");
                        }
                        file.touched=Date.now();
                    }
                    
                    if (typeof cache[id_hash]==='object') {
                        send_file(cache[id_hash]);
                    } else {
                        
                        fs_readFileSha1(filepath, function(err, file) {
                             if (err) {
                                 return error(res, 404, "Path not found");
                             }
                             send_file(cache[id_hash]=file);
                        });
            
                    }
                                    
                }
                
                
                function diffPutRequestHandler(req,res,filepath,id_hash,cache) {
                   // pretty much the same as normal put, just update interal cache
                   const file = cache[id_hash];
                   
                   
                   var chunks = [];
            
                   req.on("data", function(chunk) {
                       chunks.push(chunk);
                   });
                   req.on("error", function() {
                       error(res, 500, "Could't save file");
                   });
                   req.on("end", function() {
            
                               
                          const file_data = Buffer.concat(chunks);
                          const file_sha1 = crypto.createHash("sha1").update(file.data).digest("hex");
                          
                               
                            if (file) {
                                
                                fs_writeFileSha1(filepath,['*.',file_data,file_sha1,''],'',function(){
                                    file.data = file_data;//preloading data averts the rehash
                                    file.sha1 = file_sha1; 
                                    fs.stat(filepath,function(err,stat){
                                       fs_fileObjSync(filepath,file_data,file,stat);
                                       file.touched=Date.now();
                                    });
                                });
                            } else {
                                 fs_writeFileSha1(filepath,['*.',file_data,file_sha1,''],'',function(){
                                    fs_stat(filepath,function(err,file){
                                        file.data=file_data;//preloading data averts the rehash
                                        file.sha1=file_sha1;
                                        fs_fileObjSync(filepath,file_data,file);
                                        cache[id_hash]=file;
                                        file.touched=Date.now();
                                    });                
                                });
                            }
                     
                   });
                   
                   
                   
            
                }
                
            
                
                function diffRequestHandler(ROOT) {
                    
                    const cache = handler.cache = cleanStaleCache.cache = {};
                    
                    return handler;
                    
                    function handler(req,res) {
                    
                        var filepath = decodeURIComponent(urllib.parse(req.url).path);
                        filepath = pathlib.normalize(pathlib.join(ROOT, filepath));
                        
                        if (filePath.indexOf(ROOT) !== 0) {
                            return error(res, 500, "Hack attempt?");
                        }
                        
                        id_hash = crypto.createHash("sha1").update(filename).digest("hex"); 
                        
                        
                        switch (req.method) {
                            case 'PATCH' : return diffPatchRequestHandler(req,res,filepath,id_hash,cache) ;
                            case 'GET  ' : return diffGetRequestHandler(req,res,filepath,id_hash,cache) ;
                            case 'PUT'   : return diffPutRequestHandler(req,res,filepath,id_hash,cache) ;
                            
                        }
                        cleanStaleCache();
                    }
                }
                
                //diff(test.a,test.b);            
                })();
        }
    
     
/*<<<node*/ 




})( /*exports*/       /*node>>>*/ isNodeJS ? module.exports :/*<<<node*/  (window.stringDiffRegex={}),
    /*sha1*/          /*node>>>*/ isNodeJS ? sha1Node ()  :/*<<<node*/    sha1Browser(),
    /*perf_now*/      /*node>>>*/ isNodeJS ? perfNode     :/*<<<node*/    perfBrowser
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
    
    function perfBrowser(sample_size) { return window.performance_now(true)(sample_size); }
   
/*node>>>*/ 
    function sha1Node () {
        var crypto = require('crypto');
        return function sha1 (str,cb) {
              var shasum = crypto.createHash('sha1');
              shasum.update(str);
              var hex = shasum.digest('hex');
              return typeof cb==='function' ? setImmediate(cb,hex) : hex;
        };
    }
    
    function perfNode   (sample_size) { return require("perf_now_time")(true)(sample_size); }
/*<<<node*/     
 
}
)(/*node>>>*/typeof process==='object' && typeof module==='object'/*<<<node*/ ); 
