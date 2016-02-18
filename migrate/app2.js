/*
 known issues:
 ----------------
 https://github.com/elastic/elasticsearch-js/issues/196
 fix:
 sysctl net.ipv4.tcp_tw_reuse=1
 ----------------
 https://github.com/elastic/elasticsearch-js/issues/230
 */
"use strict";
var elastic = require('elasticsearch');
var async = require('co').wrap;

var sourceClient = new elastic.Client({host: '91.210.104.87:9200'/*, log: 'trace'*/});
var destClient = new elastic.Client({host: '91.210.104.87:9200'/*, log: 'trace'*/});

const SOURCE_INDEX = 'wobot3';
const DEST_INDEX = 'wobot31';
const BATCH_SIZE = 10000;

var total = 0;

var processPosts = async(function* (posts) {
    total += posts.length;
    var bulks = [];
    for (const post of posts) {
        bulks.push({index: {_index: DEST_INDEX, _type: 'post', _id: post._id}});
        bulks.push(post._source);
    }
    if (bulks.length) {
        yield destClient.bulk({body: bulks});
    }

    console.log("processed posts: " + total)
});

var migrate = async(function*() {
    var posts = yield sourceClient.search({
        index: SOURCE_INDEX,
        type: 'post',
        scroll: '10m',
        body: {size: BATCH_SIZE, "sort": ["_doc"]}
    });
    do {
        yield processPosts(posts.hits.hits);
        posts = yield sourceClient.scroll({scrollId: posts._scroll_id, scroll: '10m'});
    } while (posts.hits.hits.length);
});

var action = migrate();
action.then(function () {
    console.log('---------COMPLETED--------');
});
action.catch(function (err) {
    console.log('ERROR: ' + JSON.stringify(err));
});


