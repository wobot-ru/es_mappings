# curl -XDELETE 'http://localhost:9200/wobot'
curl -XPOST 'http://localhost:9200/wobot' -d @mapping.json
# curl -XGET 'http://localhost:9200/wobot/_mapping?pretty'

curl -XPOST 'http://localhost:9200/wobot/profile/kviz777' -d @profile-sample.json
curl -XPOST 'http://localhost:9200/wobot/post/post457?parent=kviz777' -d @post-sample.json