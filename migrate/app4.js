/*MIGRATES FROM OLD TO NEW SCHEMA BY DATE RANGE*/
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
var schedule = require('node-schedule');


var sourceClient = new elastic.Client({hosts: ['91.210.104.85:9200','91.210.104.95:9200','91.210.104.86:9200','91.210.104.84:9200','91.210.104.87:9200']});
var destClient = new elastic.Client({hosts: ['91.210.104.85:9200','91.210.104.95:9200','91.210.104.86:9200','91.210.104.84:9200','91.210.104.87:9200']});

const SOURCE_INDEX = 'wobot_fb';
const DEST_INDEX = 'wobot33';
const BATCH_SIZE = 3000;

const QUERY = {
    "bool": {
        "must": [
            {
                "range": {
                    "post_date": {
                        "gte": "now-14d/d",
                        "lte": "now",
                        "time_zone": "+03:00"
                    }
                }
            },
            {
                "has_parent": {
                    "parent_type": "profile",
                    "query": {
                        "match_all": {}
                    }
                }
            }
        ]
    }
};

const SORT = [
    {
        "post_date": {
            "order": "desc"
        }
    }
];

var total = 0;

var processPosts = async(function* (hits) {
    total += hits.length;
    var bulks = [];
    for (const post of hits) {
        try {
            var profile = yield sourceClient.get({index: SOURCE_INDEX, type: 'profile', id: post._parent});
            bulks.push({index: {_index: DEST_INDEX, _type: 'post', _id: post._id}});
            bulks.push({
                id: post._id,
                source: post._source.source,
                profile_id: profile._id,
                sm_profile_id: profile._source.sm_profile_id,
                profile_name: profile._source.name,
                profile_href: profile._source.href,
                profile_city: profile._source.city,
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
        catch (err) {
            //console.log(err);
        }
    }
    if (bulks.length) {
        yield destClient.bulk({body: bulks});
    }

    console.log("processed: " + total + ',\ttime: ' + new Date().toISOString())
});

var migrate = async(function*() {
    var response = yield sourceClient.search({
        index: SOURCE_INDEX,
        type: 'post',
        scroll: '10m',
        body: {size: BATCH_SIZE, query: QUERY, "sort": SORT}
    });

    do {
        yield processPosts(response.hits.hits);
        response = yield sourceClient.scroll({scrollId: response._scroll_id, scroll: '10m'});
    } while (response.hits.hits.length);
});


schedule.scheduleJob('0 0 0 * * *', function(){
    var action = migrate();
    action.then(function () {
        console.log('---------COMPLETED--------');
    });
    action.catch(function (err) {
        console.log('ERROR: ' + JSON.stringify(err));
    });
});




