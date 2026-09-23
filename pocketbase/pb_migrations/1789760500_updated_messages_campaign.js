/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2605467279")

  // add "cancelled" to status (used when a campaign is stopped)
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": ["pending", "sent", "failed", "received", "scheduled", "sending", "cancelled"]
  }))

  // link a message to the campaign that created it (optional)
  collection.fields.addAt(12, new Field({
    "cascadeDelete": true,
    "collectionId": "pbc_campaigns0001",
    "hidden": false,
    "id": "rel_msg_campaign",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "campaign",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2605467279")
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": ["pending", "sent", "failed", "received", "scheduled", "sending"]
  }))
  collection.fields.removeById("rel_msg_campaign")
  return app.save(collection)
})
