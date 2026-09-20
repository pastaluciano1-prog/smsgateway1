/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2605467279")

  // update field: add "scheduled" to the status select values
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "pending",
      "sent",
      "failed",
      "received",
      "scheduled"
    ]
  }))

  // add field: send_at (when a scheduled message should be released to pending)
  collection.fields.addAt(9, new Field({
    "help": "For scheduled messages: the time the cron flips this from scheduled -> pending.",
    "hidden": false,
    "id": "date2846843461",
    "max": "",
    "min": "",
    "name": "send_at",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "date"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2605467279")

  // revert status select values
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 0,
    "name": "status",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "pending",
      "sent",
      "failed",
      "received"
    ]
  }))

  // remove send_at
  collection.fields.removeById("date2846843461")

  return app.save(collection)
})
