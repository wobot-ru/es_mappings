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

const SOURCE_INDEX = 'wobot_fb';
const DEST_INDEX = 'wobot3';
const PROFILE_BATCH_SIZE = 1000;
const POST_BATCH_SIZE = 1000;

var total = 0;

var processPosts = async(function* (posts, profile) {
    total += posts.length;
    var bulks = [];
    for (const post of posts) {
        bulks.push({index: {_index: DEST_INDEX, _type: 'post', _id: post._id}});
        bulks.push({
            id: post._id,
            source: post._source.source,
            profile_id: profile._id,
            sm_profile_id: profile._source.sm_profile_id,
            profile_name: profile._source.name,
            profile_href: profile._source.href,
            profile_city: profile._source.city || '',
            profile_gender: profile._source.gender,
            post_href: post._source.href,
            sm_post_id: post._source.sm_post_id,
            post_body: post._source.body,
            post_date: post._source.post_date,
            engagement: post._source.engagement,
            reach: profile._source.reach,
            is_comment: post._source.is_comment,
            parent_post_id: post._source.parent_post_id,
            segment: post._source.segment,
            digest: post._source.digest,
            boost: post._source.boost,
            score: post._source.score
        });
    }
    if (bulks.length) {
        yield destClient.bulk({body: bulks});
    }

    console.log("processed posts: " + total)
});

var processProfiles = async(function* (hits) {

    for (const profile of hits) {
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


