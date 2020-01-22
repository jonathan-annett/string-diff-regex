#!/bin/bash
 
git add package.json
git add index.js
if [[ "$1" == "" ]];then
 git commit -m "auto updated"
else
 git commit
fi
git push
git rev-parse HEAD
