/*MIGRATES FROM OLD SCHEMA TO CSV FILE*/
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
var fs = require('fs');
var moment = require('moment');

var sourceClient = new elastic.Client({host: '91.210.104.87:9200'/*, log: 'trace'*/});

const SOURCE_INDEX = 'wobot_focus';
const BATCH_SIZE = 1000;

var total = 0;

var fileName = 'posts' + new Date().getTime() + '.csv';

var processPosts = async(function* (hits) {
    total += hits.length;

    for (const post of hits){
        let src = post._source;
        let date = moment(src.post_date).format('DD.MM.YYYY hh:mm:ss');
        let body = '"' + (src.body || '').replace(/[\r\n]/g, " ").replace('"', '\'') + '"';
        let href = src.href;

        fs.appendFileSync(fileName, date + ',' + body + ',' + href + '\r\n')
    }

    console.log("processed: " + total)
});

var migrate = async(function*() {
    var response = yield sourceClient.search({
        index: SOURCE_INDEX,
        type: 'post',
        scroll: '5m',
        body: {size: BATCH_SIZE, "sort": [ {"post_date": {"order": "desc"}}]}
    });

    do {
        yield processPosts(response.hits.hits);
        response = yield sourceClient.scroll({scrollId: response._scroll_id, scroll: '10m'});
    } while (response.hits.hits.length);
});

var action = migrate();
action.then(function () {
    console.log('---------COMPLETED--------');
});
action.catch(function (err) {
    console.log('ERROR: ' + JSON.stringify(err));
});


