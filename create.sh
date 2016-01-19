#!/usr/bin/env bash
# curl -XDELETE 'http://localhost:9200/wobot'
curl -XPOST 'http://localhost:9200/wobot' -d @mapping.json
# curl -XGET 'http://localhost:9200/wobot/_mapping?pretty'

curl -XPOST 'http://localhost:9200/wobot/profile/vk3000' -d @profile-sample.json
curl -XPOST 'http://localhost:9200/wobot/post/vk897?parent=vk3000' -d @post-sample.json