/*MIGRATES FROM OLD TO OLD SCHEMA (BY PROFILE)*/
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
var destClient = new elastic.Client({host: 'localhost:9200'/*, log: 'trace'*/});

const SOURCE_INDEX = 'wobot_focus';
const DEST_INDEX = 'wobot1';
const PROFILE_BATCH_SIZE = 300;
const POST_BATCH_SIZE = 300;
const LIMIT = 15000;

var total = 0;


var processPosts = async(function* (posts, profile) {

    if (total > LIMIT){
        throw Error('!!!ENOUGH')
    }

    var bulks = [];
    for (const post of posts) {
        //fix ids
        post._source.id = post._id;
        post._source.profile_id = post._parent;
        //
        bulks.push({index: {_index: DEST_INDEX, _type: 'post', _parent: post._parent, _id: post._id}});
        bulks.push(post._source);
    }
    if (bulks.length) {
        total += posts.length;
        yield destClient.bulk({body: bulks});
    }

    console.log("processed posts: " + total)
});

var processProfiles = async(function* (hits) {

    for (const profile of hits) {
        //fix id
        profile._source.id = profile._id;
        destClient.index({index: DEST_INDEX, type: 'profile', id: profile._id, body: profile._source})

        var posts = yield sourceClient.search({
            index: SOURCE_INDEX,
            type: 'post',
            scroll: '10m',
            body: {"query": {"term": {"_parent": profile._id}}, "size": POST_BATCH_SIZE}
        });
        do {
            yield processPosts(posts.hits.hits, profile);
            posts = yield sourceClient.scroll({scrollId: posts._scroll_id, scroll: '10m'});
        } while (posts.hits.hits.length);
    }

});

var migrate = async(function*() {
    var profiles = yield sourceClient.search({
        index: SOURCE_INDEX,
        type: 'profile',
        scroll: '10m',
        body: {size: PROFILE_BATCH_SIZE, "sort": ["_doc"]}
    });

    do {
        yield processProfiles(profiles.hits.hits);
        profiles = yield sourceClient.scroll({scrollId: profiles._scroll_id, scroll: '10m'});
    } while (profiles.hits.hits.length);
});

var action = migrate();
action.then(function () {
    console.log('---------COMPLETED--------');
});
action.catch(function (err) {
    console.log('ERROR: ' + JSON.stringify(err));
});


