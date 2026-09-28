/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2605467279")

  // Set once when a message's cost has been deducted from the SIM balance, so
  // it can never be charged twice (races, re-sends, retries).
  collection.fields.add(new Field({
    "hidden": false,
    "id": "bool_msg_charged",
    "name": "charged",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2605467279")
  collection.fields.removeById("bool_msg_charged")
  return app.save(collection)
})
